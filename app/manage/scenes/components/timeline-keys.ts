import { frameAt, type TransformGroup } from '@/lib/scene/transform-authoring';
import type { TransformChannel, TransformNode } from '@/lib/scene/protocol';

export type Interpolation = 'linear' | 'ease' | 'hold' | 'custom';
/** A selected key: one time across one channel (axis lane) or three (parameter lane). */
export interface KeySelection { nodeId: string; channels: readonly TransformChannel[]; time: number }
export const PARAMS: readonly TransformGroup[] = ['position', 'rotation', 'scale'];
export const channelsOf = (group: TransformGroup) => (['x', 'y', 'z'] as const).map(axis => `${group}.${axis}` as TransformChannel);
export const unitFactor = (group: TransformGroup) => group === 'rotation' ? 180 / Math.PI : 1;

/** Interpolation of the first channel that has a key at the selected time. */
export function interpolationOf(node: TransformNode, key: KeySelection): Interpolation | null {
  for (const channel of key.channels) {
    const frames = node.tracks?.[channel], index = frameAt(frames, key.time);
    if (!frames || index < 0) continue;
    const current = frames[index], next = frames[index + 1];
    if (!current.connectedRight) return 'hold';
    if (current.handles[2] === current.handles[3] && (!next || next.handles[0] === next.handles[1])) return 'linear';
    if (current.handles[2] === .42 && current.handles[3] === 0 && (!next || (next.handles[0] === .58 && next.handles[1] === 1))) return 'ease';
    return 'custom';
  }
  return null;
}

/** Apply an interpolation to the segment after the selected key on every selected channel. */
export function setInterpolation<N extends TransformNode>(node: N, key: KeySelection, mode: Exclude<Interpolation, 'custom'>): N {
  const tracks = { ...node.tracks };
  for (const channel of key.channels) {
    const source = tracks[channel], index = frameAt(source, key.time);
    if (!source || index < 0) continue;
    const frames = [...source];
    frames[index] = { ...frames[index], connectedRight: mode !== 'hold', handles: [frames[index].handles[0], frames[index].handles[1], mode === 'ease' ? .42 : 2 / 3, mode === 'ease' ? 0 : 2 / 3] };
    if (frames[index + 1]) frames[index + 1] = { ...frames[index + 1], handles: [mode === 'ease' ? .58 : 1 / 3, mode === 'ease' ? 1 : 1 / 3, frames[index + 1].handles[2], frames[index + 1].handles[3]] };
    tracks[channel] = frames;
  }
  return { ...node, tracks };
}
