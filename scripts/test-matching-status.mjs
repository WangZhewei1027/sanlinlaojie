import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(fs.readFileSync('app/manage/components/AssetEditor/hooks/useMatchingStatus.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Controlled hook effects, fetches and timers: no backend or model calls.
function mount() {
  const slots = [], effects = [], requests = [], timers = new Map();
  let cursor = 0, dirty = true, timerId = 0, current, args = ['anchor-a', 'image-a', false];
  const t = key => key;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; dirty = true; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useEffect(callback, deps) {
      const i = cursor++;
      const previous = slots[i];
      if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) {
        effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: callback() }; });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: name => name === 'react' ? react : { useTranslation: () => ({ t }) },
    AbortController, Error, TypeError, Date, Set,
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    fetch: (url, options) => new Promise((resolve, reject) => {
      requests.push({ url, ...options, resolve: (status, extra = {}) => resolve({ ok: true, json: async () => ({ data: { status, ...extra } }) }), reject });
      options.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    }),
  });
  function render() {
    while (dirty) { dirty = false; cursor = 0; current = exports.useMatchingStatus(...args); effects.splice(0).forEach(fn => fn()); }
    return current;
  }
  async function settle() { for (let i = 0; i < 12; i++) { await Promise.resolve(); render(); } return current; }
  render();
  return { requests, render, settle,
    change: (...next) => { args = next; dirty = true; return render(); },
    fire: ms => { const item = [...timers].find(([, timer]) => timer.ms === ms); assert.ok(item, `timer ${ms}`); timers.delete(item[0]); item[1].fn(); },
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
  };
}
(async () => {
  const a = mount();
  a.requests[0].resolve('pending');
  assert.equal((await a.settle()).status, 'pending');
  a.fire(3000);
  a.requests[1].resolve('ready', { updated_at: '2026-09-09T02:30:00Z' });
  assert.equal((await a.settle()).status, 'ready');
  assert.equal(a.render().updatedAt, '2026-09-09T02:30:00Z');
  a.render().rebuild(); a.render();
  assert.equal(a.requests[2].method, 'POST');
  assert.equal(a.render().status, 'processing');
  a.requests[2].resolve('ready'); await a.settle();
  assert.equal(a.requests[3].method, 'GET');
  a.requests[3].resolve('ready'); await a.settle();
  a.change('anchor-a', 'image-b', false);
  assert.equal(a.requests[4].method, 'GET', 'image changes must not replay a generation command');
  a.unmount();
  console.log('PASS pending polling, generation confirmation, timestamp and no POST replay');

  const b = mount();
  b.render().rebuild(); b.render();
  b.requests[0].resolve('ready'); await b.settle();
  assert.equal(b.render().status, 'processing', 'stale status must not overwrite generation');
  b.change('anchor-b', 'image-b', false);
  b.requests[1].resolve('ready'); await b.settle();
  assert.equal(b.render().status, 'loading', 'old generation must not overwrite another asset');
  b.requests[2].reject(new TypeError('Network unavailable')); await b.settle();
  assert.equal(b.render().status, 'status_error', 'read failures are not generation failures');
  b.unmount();
  console.log('PASS stale reads/generation, asset changes and status-read errors');

  const c = mount();
  c.render().rebuild(); c.render();
  c.fire(65000); await c.settle();
  assert.equal(c.render().status, 'status_error', 'timeout means unknown completion, not confirmed failure');
  assert.equal(c.render().error, 'matching.requestTimeout');
  c.render().refresh(); c.render();
  assert.equal(c.requests.at(-1).method, 'GET');
  c.unmount();
  assert.equal(c.requests.at(-1).signal.aborted, true);
  console.log('PASS generation timeout, manual refresh and cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
