// Run: node scripts/test-viewer-resources.mjs
// Replay incremental content hydration against the actual viewer modules, with
// deterministic Cesium entities/canvas and an atlas that retains image keys.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve('public/js/viewer/src');
let added = 0, removed = 0, canvases = 0, imageLoads = 0, audioCreated = 0, audioPaused = 0;
const entities = new Set(), listeners = new Set(), atlas = new Set(), timers = new Set();
const property = value => ({ getValue: () => value });
const point = (x, y, z) => ({ x, y, z });
const equals = (a, b) => a?.x === b?.x && a?.y === b?.y && a?.z === b?.z;
const color = name => ({ name, withAlpha: alpha => ({ name, alpha }) });
const Cesium = {
  Cartesian3: { fromDegrees: point, equals, distance: (a, b) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z) },
  JulianDate: { now: () => 0 }, NearFarScalar: class {},
  Color: Object.fromEntries(['CYAN', 'WHITE', 'YELLOW', 'RED'].map(key => [key, color(key)])),
  VerticalOrigin: { BOTTOM: 0 }, ArcType: { NONE: 0 },
};
let suspension = 0;
const viewer = {
  clock: { currentTime: 0 },
  camera: { position: point(0, 0, 1000), moveEnd: {
    addEventListener: fn => listeners.add(fn), removeEventListener: fn => listeners.delete(fn),
  } },
  entities: {
    suspendEvents: () => suspension++, resumeEvents: () => suspension--,
    add(input) {
      added++;
      const entity = { ...input };
      let position = property(input.position);
      Object.defineProperty(entity, 'position', { get: () => position, set: value => { position = property(value); } });
      entity.properties = new Proxy(Object.fromEntries(Object.entries(input.properties ?? {}).map(([key, value]) => [key, property(value)])), {
        set(target, key, value) { target[key] = property(value); return true; },
      });
      entities.add(entity); return entity;
    },
    remove(entity) { if (entities.delete(entity)) removed++; },
  },
};
function canvas() {
  canvases++;
  const ops = [];
  const ctx = new Proxy({}, {
    set(target, key, value) { target[key] = value; ops.push([key, value]); return true; },
    get(target, key) {
      if (key === 'measureText') return text => ({ width: text.length * 7 });
      return target[key] ?? ((...args) => ops.push([key, ...args.map(arg => typeof arg === 'object' ? arg.src ?? 'image' : arg)]));
    },
  });
  return { width: 0, height: 0, getContext: () => ctx, toDataURL: () => `data:image/mock,${JSON.stringify(ops)}` };
}
const pendingImages = [];
class ImageMock {
  constructor() { imageLoads++; this.width = 100; this.height = 100; }
  set src(value) { this.url = value; pendingImages.push(this); }
  get src() { return this.url; }
}
class AudioMock {
  constructor(src) { audioCreated++; this.src = src; }
  pause() { audioPaused++; }
  play() { return Promise.resolve(); }
}
const modules = new Map([[path.join(root, 'managers/viewerManager.js'), { getViewer: () => viewer, flyTo() {} }]]);
function load(relative) {
  const filename = path.resolve(root, relative);
  if (modules.has(filename)) return modules.get(filename);
  const exports = {}; modules.set(filename, exports);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, Cesium, URLSearchParams, Image: ImageMock, Audio: AudioMock,
    window: { location: { search: '' }, matchMedia: () => ({ matches: false }) },
    navigator: { userAgent: 'test', maxTouchPoints: 0 },
    document: { createElement: canvas }, console: { log() {}, warn: console.warn },
    setInterval: fn => { timers.add(fn); return fn; }, clearInterval: fn => timers.delete(fn),
    setTimeout, clearTimeout,
    require: name => load(path.resolve(path.dirname(filename), name)),
  }, { filename });
  return exports;
}
const assets = load('managers/assetManager.js');
const selection = load('managers/selectionManager.js');
function render(items) {
  assets.displayAssets(structuredClone(items));
  selection.reapplyHighlight();
  assert.equal(suspension, 0, 'entity events resume after each update');
  for (const entity of assets.getAssetBillboards()) atlas.add(entity.billboard.image);
}
function moveCamera(position) {
  viewer.camera.position = position;
  for (const fn of listeners) fn();
  for (const entity of assets.getAssetBillboards()) atlas.add(entity.billboard.image);
}
const rows = Array.from({ length: 413 }, (_, i) => ({
  id: `placement-${i}`, file_type: i % 2 ? 'image' : 'text', file_url: null,
  text_content: null, name: `Placement ${i}`, anchor_id: null,
  metadata: { longitude: i * 100, latitude: 0, height: 0 },
}));
render(rows);
const firstEntities = assets.getAssetBillboards().slice();
selection.setSelection([rows[0].id], { silent: true });
for (let i = 0; i < rows.length; i++) {
  if (rows[i].file_type === 'image') rows[i].file_url = `https://fixture.invalid/${i}.jpg`;
  else rows[i].text_content = `Content ${i}`;
  render(rows);
}
assert.equal(added, 413, 'hydrating 413 responses must not recreate all 413 entities');
assert.equal(removed, 0);
assert.equal(atlas.size, 2, 'all far markers share exactly two stable texture keys');
assert.equal(canvases, 2);
assert.equal(imageLoads, 0, 'distant image markers do not download full previews');
assert.ok(firstEntities.every((entity, i) => entity === assets.getAssetBillboards()[i]));
assert.equal(firstEntities[0].billboard.color, Cesium.Color.YELLOW, 'selection survives hydration');
assert.equal(listeners.size, 1, 'one camera listener');
assert.equal(timers.size, 1, 'one audio distance timer');
console.log('PASS 413 incremental responses: 413 entities, 2 shared atlas entries, no full rebuilds');

// Same server payload must undo a failed optimistic drag.
assets.setEntityPositionDegrees(firstEntities[0], 999, 999, 0);
render(rows);
assert.ok(equals(firstEntities[0].position.getValue(), point(0, 0, 0)));
moveCamera(point(0, 0, 5));
const detail = firstEntities[0].billboard.image, detailCanvasCount = canvases;
for (let i = 0; i < 30; i++) { moveCamera(point(0, 0, 1000)); moveCamera(point(0, 0, 5)); }
assert.equal(firstEntities[0].billboard.image, detail);
assert.equal(canvases, detailCanvasCount, 'zoom cycling reuses the same detail image');
rows[0].text_content = 'Updated text'; render(rows);
assert.notEqual(firstEntities[0].billboard.image, detail, 'content changes invalidate only that detail');
assert.equal(canvases, detailCanvasCount + 1);
console.log('PASS selection, drag rollback, content edits and repeated near/far texture reuse');

// A late photo must neither overwrite the far marker nor an edited preview.
moveCamera(point(100, 0, 5));
const photo = firstEntities[1];
moveCamera(point(0, 0, 1000));
const dot = photo.billboard.image;
pendingImages.shift().onload();
await new Promise(resolve => setImmediate(resolve));
assert.equal(photo.billboard.image, dot);
moveCamera(point(100, 0, 5));
await new Promise(resolve => setImmediate(resolve));
assert.notEqual(photo.billboard.image, dot);
rows[1].file_url = 'https://fixture.invalid/updated.jpg'; render(rows);
rows[1].file_url = 'https://fixture.invalid/latest.jpg'; render(rows);
const stale = pendingImages.shift(), latest = pendingImages.shift();
latest.onload(); await new Promise(resolve => setImmediate(resolve));
const latestTexture = photo.billboard.image;
stale.onload(); await new Promise(resolve => setImmediate(resolve));
assert.equal(photo.billboard.image, latestTexture);
console.log('PASS asynchronous previews cannot overwrite newer content or far markers');

moveCamera(point(0, 0, 1000));
rows[2] = { ...rows[2], file_type: 'audio', file_url: 'https://fixture.invalid/audio.mp3' };
render(rows); render(rows);
assert.equal(audioCreated, 1, 'unchanged snapshots preserve audio');
rows[2].file_url = 'https://fixture.invalid/audio-new.mp3'; render(rows);
assert.equal(audioCreated, 2); assert.equal(audioPaused, 1);
rows.splice(2, 1); render(rows);
assert.equal(audioPaused, 2); assert.equal(removed, 1);
assert.equal(assets.getEntityByAssetId('placement-2'), null);
assets.clearAssetBillboards();
assert.equal(entities.size, 0); assert.equal(timers.size, 0); assert.equal(listeners.size, 0);
assert.equal(assets.getEntityByAssetId('placement-0'), null);
console.log('PASS audio replacement, filtered removals and complete resource cleanup');
