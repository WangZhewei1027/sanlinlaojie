export type DockSizes = { left: number; right: number; bottom?: number };
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Pixel-sized grid cells retain the dock topology while the library handles resize gestures. */
export function sceneDockLayout(width: number, height: number, sizes: DockSizes) {
  const leftMax = Math.min(420, width - 260 - 240);
  const left = clamp(sizes.left, 180, leftMax);
  const rightMax = Math.min(420, width - left - 240);
  const right = clamp(sizes.right, 260, rightMax);
  const bottomMin = Math.min(180, height / 3);
  const bottomMax = height - Math.min(220, height / 2);
  const bottom = clamp(sizes.bottom ?? clamp((height + 82) * .34, 240, 360), bottomMin, bottomMax);
  const top = height - bottom;
  return { left, right, bottom, leftMax: Math.min(420, width - right - 240), rightMax, bottomMin, bottomMax, panels: {
    objects: { x: 0, y: 0, w: left, h: top },
    scene: { x: left, y: 0, w: width - left - right, h: top },
    inspector: { x: width - right, y: 0, w: right, h: top },
    timeline: { x: 0, y: top, w: width, h: bottom },
  } };
}
