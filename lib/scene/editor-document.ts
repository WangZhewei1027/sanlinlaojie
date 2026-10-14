import { Euler, Quaternion } from "three";
import { TRANSFORM_CHANNELS, type CompositionInstance, type SceneDefinition, type TransformChannel } from "./protocol";
import { instanceValues, type TransformValues } from "./theatre-state";

export type TransformGroup = keyof TransformValues;
export const TRANSFORM_GROUPS = ["position", "rotation", "scale"] as const;
export const AXES = ["x", "y", "z"] as const;
export const snapTime = (time: number) => Math.round(time * 30) / 30;
export const nearTime = (a: number, b: number) => Math.abs(a - b) < 0.0001;
export const groupChannels = (group: TransformGroup) => TRANSFORM_CHANNELS.filter((channel) => channel.startsWith(`${group}.`));

function baseValue(instance: CompositionInstance, channel: TransformChannel, value: number): CompositionInstance {
  const [group, axis] = channel.split(".") as [TransformGroup, typeof AXES[number]];
  const values = instanceValues(instance);
  values[group][axis] = value;
  return { ...instance,
    position: AXES.map((key) => values.position[key]) as [number, number, number],
    scale: AXES.map((key) => values.scale[key]) as [number, number, number],
    quaternion: new Quaternion().setFromEuler(new Euler(values.rotation.x, values.rotation.y, values.rotation.z, "XYZ")).toArray(),
  };
}

/** All authoring lives in the portable scene document; playback never changes it. */
export function setTransform(instance: CompositionInstance, channel: TransformChannel, value: number, time: number, record: boolean): CompositionInstance {
  const frames = instance.tracks?.[channel] ?? [];
  if (!record && !frames.length) return baseValue(instance, channel, value);
  const [group, axis] = channel.split(".") as [TransformGroup, typeof AXES[number]];
  const position = snapTime(time);
  const existing = frames.find((frame) => nearTime(frame.time, position));
  const next = frames.filter((frame) => !nearTime(frame.time, position));
  // Preserve the initial pose when recording the first movement later in the sequence.
  if (!frames.length && position > 0) next.push({ time: 0, value: instanceValues(instance)[group][axis], handles: [0.5, 1, 0.5, 0], connectedRight: true });
  next.push({ time: position, value, handles: existing?.handles ?? [0.5, 1, 0.5, 0], connectedRight: existing?.connectedRight ?? true });
  return { ...instance, tracks: { ...instance.tracks, [channel]: next.sort((a, b) => a.time - b.time) } };
}

export function keyTimes(instance: CompositionInstance, group?: TransformGroup) {
  return [...new Set((group ? groupChannels(group) : TRANSFORM_CHANNELS).flatMap((channel) => instance.tracks?.[channel]?.map((frame) => frame.time) ?? []))].sort((a, b) => a - b);
}

export function moveKeys(instance: CompositionInstance, group: TransformGroup, from: number, to: number): CompositionInstance {
  const tracks = { ...instance.tracks };
  for (const channel of groupChannels(group)) {
    const frames = tracks[channel] ?? [];
    const selected = frames.find((frame) => nearTime(frame.time, from));
    if (selected) tracks[channel] = [...frames.filter((frame) => !nearTime(frame.time, from) && !nearTime(frame.time, to)), { ...selected, time: to }].sort((a, b) => a.time - b.time);
  }
  return { ...instance, tracks };
}

export function deleteKeys(instance: CompositionInstance, group: TransformGroup, time: number): CompositionInstance {
  const tracks = { ...instance.tracks };
  for (const channel of groupChannels(group)) {
    tracks[channel] = (tracks[channel] ?? []).filter((frame) => !nearTime(frame.time, time));
    if (!tracks[channel]?.length) delete tracks[channel];
  }
  return { ...instance, tracks };
}

export function minimumDuration(definition: SceneDefinition) {
  return Math.max(0.1, ...definition.content.instances.flatMap((instance) => [...keyTimes(instance), instance.animation?.startSeconds ?? 0]));
}
