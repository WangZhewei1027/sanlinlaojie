import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { createSceneCore } from '@spatial-memory/scene-core';
import type { CompositionContent, CompositionInstance } from '../lib/scene/protocol';
import { Editor } from '../vendor/three-editor';
import { MediaPlayback } from '../app/manage/scenes/components/three-editor/media-playback';
import { EditorModels } from '../app/manage/scenes/components/three-editor/models';
import { ModelPool } from '../app/manage/scenes/components/three-editor/model-pool';
import type { ThreeViewportProps } from '../app/manage/scenes/components/three-editor/types';
import { DEFAULT_SCENE_CAMERA } from '../app/manage/scenes/components/three-editor/spatial-reference';
import { EventTargetFixture } from './test-support/performance-hosts';

const instance = (): CompositionInstance => ({ id: 'video', asset: 'video', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], animation: null,
  timing: { startSeconds: 2, endSeconds: 10, fadeInSeconds: 2, fadeOutSeconds: 2 },
  media: { trimStartSeconds: 3, trimEndSeconds: 7, playbackRate: 2, volume: 0.8, loop: false, muted: false },
});

class FakeMedia extends EventTargetFixture {
  duration = 20; currentTime = 0; volume = 1; muted = false; playbackRate = 1; loop = false; readyState = 1; paused = true;
  plays = 0; pauses = 0; loads = 0; srcRemoved = false;
  src = ''; preload = '';
  reject?: Error; deferred?: Promise<void>;
  play() { this.plays++; if (this.reject) return Promise.reject(this.reject); this.paused = false; return this.deferred ?? Promise.resolve(); }
  pause() { this.pauses++; this.paused = true; }
  removeAttribute(name: string) { if (name === 'src') { this.srcRemoved = true; this.src = ''; } }
  load() { this.loads++; }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const player = (media: FakeMedia, onError: (blocked: boolean) => void = () => {}) => new MediaPlayback(media as unknown as HTMLMediaElement, 'https://fixture.example/source.mp4', onError);

test('media starts at its scene cue, maps trim/speed, fades volume and stops at the source out point', async () => {
  const media = new FakeMedia(), playback = player(media), node = instance();
  playback.sync(node, 1, true, 12);
  assert.equal(media.plays, 0); assert.equal(media.currentTime, 3); assert.equal(media.volume, 0);
  playback.sync(node, 3, true, 12); await flush();
  assert.equal(media.plays, 1); assert.equal(media.currentTime, 5); assert.equal(media.playbackRate, 2); assert.equal(media.volume, 0.4);
  playback.sync(node, 3.01, true, 12); assert.equal(media.plays, 1, 'RAF must not create repeated play requests');
  playback.sync(node, 4, true, 12); assert.equal(media.currentTime, 7); assert.equal(media.paused, true);
  node.media!.loop = true;
  playback.sync(node, 4.5, true, 12); await flush();
  assert.equal(media.currentTime, 4); assert.equal(media.plays, 2); assert.equal(media.loop, false, 'native loops must never escape trims');
  node.media!.muted = true;
  playback.sync(node, 5.1, false, 12); assert.equal(media.paused, true); assert.equal(media.muted, true); assert.ok(Math.abs(media.currentTime - 5.2) < 1e-10);
  playback.sync(node, 10, true, 12); assert.equal(media.paused, true, 'out cue is exclusive');
  playback.dispose(); assert.equal(media.srcRemoved, true); assert.equal(media.loads, 2);
});

test('media stays unfetched outside its preload window and starts progressively after metadata at the current trim position', async () => {
  const media = new FakeMedia(), playback = player(media), node = instance();
  media.readyState = 0; media.duration = NaN;
  assert.equal(media.src, '');
  playback.sync(node, 0, false, 12, false);
  assert.equal(media.loads, 0);
  playback.sync(node, 1, false, 12, true);
  assert.equal(media.src, 'https://fixture.example/source.mp4');
  assert.equal(media.preload, 'auto'); assert.equal(media.loads, 1); assert.equal(media.plays, 0);
  playback.sync(node, 3, true, 12, true);
  assert.equal(media.plays, 0, 'trimmed media cannot leak audio from source start while metadata loads');
  media.readyState = 1; media.duration = 20; media.emit('loadedmetadata'); await flush();
  assert.equal(media.currentTime, 5); assert.equal(media.plays, 1, 'play starts before HAVE_ENOUGH_DATA or a complete download');
  playback.sync(node, 11, true, 12, false);
  assert.equal(media.src, ''); assert.equal(media.paused, true); assert.equal(media.preload, 'none');
  media.emit('loadedmetadata'); await flush(); assert.equal(media.plays, 1, 'late metadata cannot revive an evicted cue');
  playback.sync(node, 11, true, 12, true);
  assert.equal(media.currentTime, 3, 'a cue prepared across loop wrap buffers from its trim in point');
  playback.dispose(); assert.equal(media.listeners.get('loadedmetadata')?.size, 0);
});

test('a released pending play cannot pause or unblock a newer source load', async () => {
  const media = new FakeMedia(), playback = player(media);
  let finishOld!: () => void, finishNew!: () => void;
  media.deferred = new Promise<void>(resolve => { finishOld = resolve; });
  playback.sync(instance(), 3, true, 12, true);
  playback.sync(instance(), 11, true, 12, false);
  media.deferred = new Promise<void>(resolve => { finishNew = resolve; });
  playback.sync(instance(), 3, true, 12, true);
  finishOld(); await flush();
  assert.equal(media.paused, false); assert.equal(media.plays, 2);
  media.paused = true;
  playback.sync(instance(), 3.1, true, 12, true);
  assert.equal(media.plays, 2, 'the newer pending request remains protected');
  finishNew(); await flush(); playback.dispose();
});

test('blocked autoplay reports once until the user pauses and retries', async () => {
  const media = new FakeMedia(), errors: boolean[] = [], playback = player(media, blocked => errors.push(blocked));
  media.reject = Object.assign(new Error('blocked'), { name: 'NotAllowedError' });
  playback.sync(instance(), 3, true, 12); await flush();
  playback.sync(instance(), 3.1, true, 12); await flush();
  assert.deepEqual(errors, [true]); assert.equal(media.plays, 1);
  playback.sync(instance(), 3.1, false, 12); media.reject = undefined;
  playback.sync(instance(), 3.1, true, 12); await flush();
  assert.equal(media.plays, 2); assert.equal(media.paused, false);
  playback.dispose();
});

test('a source shorter than its trim in point never enters a playback retry loop', () => {
  const media = new FakeMedia(), playback = player(media), node = instance();
  media.duration = 2; node.media!.loop = true;
  playback.sync(node, 3, true, 12); playback.sync(node, 3.1, true, 12);
  assert.equal(media.currentTime, 2); assert.equal(media.plays, 0);
  playback.dispose();
});

test('pausing or disposing during pending play cannot restart released media', async () => {
  const media = new FakeMedia(); let resolve!: () => void;
  media.deferred = new Promise<void>(done => { resolve = done; });
  const playback = player(media);
  playback.sync(instance(), 3, true, 12);
  playback.sync(instance(), 3.1, false, 12);
  playback.dispose(); resolve(); await flush();
  assert.equal(media.paused, true); assert.equal(media.srcRemoved, true);
  playback.sync(instance(), 3.2, true, 12); assert.equal(media.plays, 1);
});

test('model fades are isolated per instance and geometry/material registries release cleanly', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const template = new Group(); template.add(new Mesh(geometry, material));
  let geometryDisposed = 0; geometry.addEventListener('dispose', () => geometryDisposed++);
  // The pool contract only consumes the scene and animation data in this renderer fixture.
  const gltf = { scene: template, animations: [] } as unknown as GLTF;
  const a = { ...instance(), id: 'a', asset: 'model' }, b = { ...instance(), id: 'b', asset: 'model', timing: undefined };
  const content: CompositionContent = { kind: 'composition', units: 'meters', durationSeconds: 12, loop: false, assets: { model: { assetId: 'model' } }, instances: [a, b] };
  const session = createSceneCore({ content });
  const editor = new Editor({ config: { getKey: () => 'en', setKey() {} }, history: { clear() {}, execute() {} } });
  const props: ThreeViewportProps = { session, instances: content.instances, resolveUrl: () => 'fixture.glb', onClips() {}, onSelect() {}, onTransform() {}, onError(message) { assert.fail(message); }, fitRef: { current: null }, originRef: { current: null }, previewRef: { current: null }, placementRef: { current: null }, toolsRef: { current: null }, cameraSettings: DEFAULT_SCENE_CAMERA, selectedId: null, grid: true, editable: true, preview: false, language: 'en' };
  let ready = 0; let finish!: () => void; const loaded = new Promise<void>(resolve => { finish = resolve; });
  const models = new EditorModels(editor, () => props, () => false, () => { if (++ready === 2) finish(); }, new ModelPool(async () => gltf));
  models.sync(); await loaded;
  session.seek(3); models.frame();
  const first = models.entries.get('a')!, second = models.entries.get('b')!;
  assert.equal(first.materials![0].material.opacity, 0.5);
  assert.equal(second.materials![0].material.opacity, 1); assert.equal(material.opacity, 1);
  assert.notEqual(first.materials![0].material, second.materials![0].material);
  session.seek(10); models.frame(); assert.equal(first.root!.visible, false); assert.equal(second.root!.visible, true);
  props.selectedId = 'a'; models.frame(); assert.equal(first.root!.visible, true, 'selected out-of-cue nodes remain editable as ghosts');
  assert.equal(first.materials![0].material.opacity, 0.2);
  props.preview = true; models.frame(); assert.equal(first.root!.visible, false);
  models.remove('a'); assert.equal(geometryDisposed, 0, 'one remaining instance still owns shared geometry');
  models.dispose(); session.dispose();
  assert.equal(geometryDisposed, 1); assert.equal(editor.scene.children.length, 0);
  assert.equal(Object.keys(editor.geometries).length, 0); assert.equal(editor.materialsRefCounter.size, 0);
});
