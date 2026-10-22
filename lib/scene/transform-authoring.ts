import { sampleInstance, type Vector } from '@spatial-memory/scene-core';
import type { CompositionInstance, TransformChannel, TransformKeyframe } from './protocol';
export type TransformGroup = 'position' | 'rotation' | 'scale';
export const frameAt = (frames: TransformKeyframe[] | undefined, time: number) => frames?.findIndex(f => Math.abs(f.time - time) < 0.0005) ?? -1;
export const roundTime = (time: number) => Math.round(time * 1000) / 1000;
export function setKey(instance: CompositionInstance, channel: TransformChannel, time: number, value: number): CompositionInstance {
  const frames = [...(instance.tracks?.[channel] ?? [])];
  const index = frameAt(frames, time);
  const frame: TransformKeyframe = index >= 0 ? { ...frames[index], value } : { time: roundTime(time), value, handles: [1 / 3, 1 / 3, 2 / 3, 2 / 3], connectedRight: true };
  if (index >= 0) frames[index] = frame; else frames.push(frame);
  frames.sort((a, b) => a.time - b.time);
  return { ...instance, tracks: { ...instance.tracks, [channel]: frames } };
}
export function editChannel(instance: CompositionInstance, channel: TransformChannel, time: number, value: number) {
  if (instance.tracks?.[channel]?.length) return setKey(instance, channel, time, value);
  const [group, axis] = channel.split('.') as [TransformGroup, 'x' | 'y' | 'z'];
  const tuple = [...instance[group]] as [number, number, number]; tuple['xyz'.indexOf(axis)] = value;
  return { ...instance, [group]: tuple };
}
export function editTransform(instance: CompositionInstance, group: TransformGroup, time: number, value: Vector) {
  for (const axis of ['x', 'y', 'z'] as const) instance = editChannel(instance, `${group}.${axis}`, time, value[axis]);
  return instance;
}
export function removeKey(instance: CompositionInstance, channel: TransformChannel, time: number) {
  const tracks = { ...instance.tracks };
  const frames = tracks[channel]?.filter(f => Math.abs(f.time - time) >= 0.0005) ?? [];
  if (frames.length) tracks[channel] = frames;
  else delete tracks[channel];
  // Removing the final key keeps its visible pose as the new static value.
  const [group, axis] = channel.split('.') as [TransformGroup, 'x' | 'y' | 'z'];
  const result = editChannel({ ...instance, tracks }, channel, time, sampleInstance(instance, time)[group][axis]);
  return frames.length ? { ...instance, tracks } : result;
}
