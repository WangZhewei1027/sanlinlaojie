import { sampleInstance, type Vector } from '@spatial-memory/scene-core';
import type { TransformChannel, TransformKeyframe, TransformNode } from './protocol';
/** Instances and groups share the same transform authoring. */
type Node = TransformNode & { id: string };
export type TransformGroup = 'position' | 'rotation' | 'scale';
export const frameAt = (frames: TransformKeyframe[] | undefined, time: number) => frames?.findIndex(f => Math.abs(f.time - time) < 0.0005) ?? -1;
export const roundTime = (time: number) => Math.round(time * 1000) / 1000;
export function setKey<N extends Node>(instance: N, channel: TransformChannel, time: number, value: number): N {
  const frames = [...(instance.tracks?.[channel] ?? [])];
  const index = frameAt(frames, time);
  const frame: TransformKeyframe = index >= 0 ? { ...frames[index], value } : { time: roundTime(time), value, handles: [1 / 3, 1 / 3, 2 / 3, 2 / 3], connectedRight: true };
  if (index >= 0) frames[index] = frame; else frames.push(frame);
  frames.sort((a, b) => a.time - b.time);
  return { ...instance, tracks: { ...instance.tracks, [channel]: frames } };
}
export function editChannel<N extends Node>(instance: N, channel: TransformChannel, time: number, value: number): N {
  if (instance.tracks?.[channel]?.length) return setKey(instance, channel, time, value);
  const [group, axis] = channel.split('.') as [TransformGroup, 'x' | 'y' | 'z'];
  const tuple = [...instance[group]] as [number, number, number]; tuple['xyz'.indexOf(axis)] = value;
  return { ...instance, [group]: tuple };
}
export function editTransform<N extends Node>(instance: N, group: TransformGroup, time: number, value: Vector): N {
  for (const axis of ['x', 'y', 'z'] as const) instance = editChannel(instance, `${group}.${axis}`, time, value[axis]);
  return instance;
}
export function removeKey<N extends Node>(instance: N, channel: TransformChannel, time: number): N {
  const tracks = { ...instance.tracks };
  const frames = tracks[channel]?.filter(f => Math.abs(f.time - time) >= 0.0005) ?? [];
  if (frames.length) tracks[channel] = frames;
  else delete tracks[channel];
  // Removing the final key keeps its visible pose as the new static value.
  const [group, axis] = channel.split('.') as [TransformGroup, 'x' | 'y' | 'z'];
  const result = editChannel({ ...instance, tracks }, channel, time, sampleInstance(instance, time)[group][axis]);
  return frames.length ? { ...instance, tracks } : result;
}

/** Key times across the given channels, merged within the keyframe tolerance. */
export function keyTimes(node: TransformNode, channels: readonly TransformChannel[]) {
  const times: number[] = [];
  for (const channel of channels) for (const frame of node.tracks?.[channel] ?? []) if (!times.some(time => Math.abs(time - frame.time) < 0.0005)) times.push(frame.time);
  return times.sort((a, b) => a - b);
}
/** Retime every listed channel's key at `from`; refuses when a channel already has a key at `to`. */
export function moveKeys<N extends Node>(node: N, channels: readonly TransformChannel[], from: number, to: number): N {
  if (channels.some(channel => frameAt(node.tracks?.[channel], from) >= 0 && frameAt(node.tracks?.[channel], to) >= 0)) return node;
  const tracks = { ...node.tracks };
  for (const channel of channels) {
    const frames = tracks[channel], index = frameAt(frames, from);
    if (!frames || index < 0) continue;
    const next = [...frames]; next[index] = { ...next[index], time: roundTime(to) }; next.sort((a, b) => a.time - b.time);
    tracks[channel] = next;
  }
  return { ...node, tracks };
}
