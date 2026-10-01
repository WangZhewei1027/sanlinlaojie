// Fixed-window in-memory rate limiter for the anonymous mini-program write
// endpoint. State lives in the single app process (one container today);
// move it to Redis before running several app instances.

interface Window {
  start: number;
  count: number;
}

const windows = new Map<string, Window>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, w] of windows) {
    if (now - w.start >= windowMs) windows.delete(key);
  }
}

/**
 * Count one request against `key`; true when it is within `limit` per
 * `windowMs`. Keys should be namespaced, e.g. `text:ip:1.2.3.4`.
 */
export function allowRequest(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  sweep(now, windowMs);
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}
