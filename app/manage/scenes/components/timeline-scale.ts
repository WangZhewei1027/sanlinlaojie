import { COMPOSITION_LIMITS } from '@/lib/scene/protocol';
import { roundTime } from '@/lib/scene/transform-authoring';

/** Width of the sticky track-header column; lanes start right after it. */
export const TIMELINE_LABEL_WIDTH = 300;
/** Gutter before 0s so the playhead head is never clipped by the channel column. */
export const TIMELINE_LEAD = 12;
export const MIN_SCENE_DURATION = 0.1;
export interface GridSteps { major: number; minor: number }
// Labelled ticks and the snap grid between them, from finest to coarsest.
const STEPS: GridSteps[] = [[0.1, 0.02], [0.2, 0.05], [0.5, 0.1], [1, 0.25], [2, 0.5], [5, 1], [10, 2], [15, 5], [30, 5], [60, 15], [120, 30]].map(([major, minor]) => ({ major, minor }));

/** Pick the finest grid whose labels stay at least 72px apart. */
export const gridSteps = (pxPerSecond: number) => STEPS.find(step => step.major * pxPerSecond >= 72) ?? STEPS[STEPS.length - 1];
export const snapTime = (time: number, step: number) => roundTime(Math.round(time / step) * step);
/** Visible range for content ending at `end`: some room past the scene end marker to drag it longer. */
export function fitSpan(end: number) {
  const target = Math.max(end, 1) * 1.15, step = target > 60 ? 10 : target > 20 ? 5 : 1;
  return Math.min(Math.ceil(target / step) * step, Math.ceil(COMPOSITION_LIMITS.maxDurationSeconds * 1.15));
}
export function formatTime(time: number, major: number) {
  const digits = major < 1 ? 1 : 0;
  if (time < 60) return `${Number(time.toFixed(digits))}s`;
  const seconds = time % 60;
  return `${Math.floor(time / 60)}:${seconds.toFixed(digits).padStart(digits ? 4 : 2, '0')}`;
}
