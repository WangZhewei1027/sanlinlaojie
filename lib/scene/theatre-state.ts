import { Euler, Quaternion } from "three";
import { TRANSFORM_CHANNELS, type CompositionInstance, type SceneDefinition } from "./protocol";

export function instanceValues(instance: CompositionInstance) {
  const rotation = new Euler().setFromQuaternion(new Quaternion(...instance.quaternion), "XYZ");
  return {
    position: { x: instance.position[0], y: instance.position[1], z: instance.position[2] },
    rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
    scale: { x: instance.scale[0], y: instance.scale[1], z: instance.scale[2] },
  };
}
export type TransformValues = ReturnType<typeof instanceValues>;

/** Imports both legacy layouts and version 2 timelines without requiring editor metadata. */
export function stateFromDefinition(definition: SceneDefinition) {
  const byObject: Record<string, unknown> = {};
  const tracksByObject: Record<string, unknown> = {};
  for (const instance of definition.content.instances) {
    byObject[instance.id] = instanceValues(instance);
    const trackIdByPropPath: Record<string, string> = {};
    const trackData: Record<string, unknown> = {};
    for (const channel of TRANSFORM_CHANNELS) {
      const frames = instance.tracks?.[channel];
      if (!frames?.length) continue;
      const id = channel.replace(".", "_");
      trackIdByPropPath[JSON.stringify(channel.split("."))] = id;
      trackData[id] = { type: "BasicKeyframedTrack", keyframes: frames.map((frame, index) => ({
        id: `${id}_${index}`, position: frame.time, value: frame.value, handles: frame.handles,
        connectedRight: frame.connectedRight, type: frame.connectedRight ? "bezier" : "hold",
      })) };
    }
    tracksByObject[instance.id] = { trackIdByPropPath, trackData };
  }
  return { definitionVersion: "0.4.0", revisionHistory: [], sheetsById: { Scene: {
    staticOverrides: { byObject },
    sequence: { type: "PositionalSequence", length: definition.content.durationSeconds ?? 10, subUnitsPerUnit: 30, tracksByObject },
  } } };
}
