/** Historical schema 4 → 5 conversion. Only the migration runner imports this. */
import { TRANSFORM_CHANNELS, type CompositionContent, type CompositionInstance } from "../../lib/scene/protocol";
export type LegacyInstance = Omit<CompositionInstance, "rotation"> & { quaternion: [number, number, number, number] };
export type LegacyContent<Ref = { assetId: string }> = Omit<CompositionContent<Ref>, "instances"> & { instances: LegacyInstance[] };
export type NativeState = ReturnType<typeof stateFromDefinition>;
export function legacyValues(instance: LegacyInstance) {
  const [x, y, z, w] = instance.quaternion;
  const m13 = 2 * (x * z + w * y);
  const rotation = { y: Math.asin(Math.max(-1, Math.min(1, m13))), x: 0, z: 0 };
  if (Math.abs(m13) < 0.9999999) {
    rotation.x = Math.atan2(2 * (w * x - y * z), 1 - 2 * (x * x + y * y));
    rotation.z = Math.atan2(2 * (w * z - x * y), 1 - 2 * (y * y + z * z));
  } else rotation.x = Math.atan2(2 * (y * z + w * x), 1 - 2 * (x * x + z * z));
  const v = (a: number[]) => ({ x: a[0], y: a[1], z: a[2] });
  return { position: v(instance.position), rotation, scale: v(instance.scale) };
}
export function stateFromDefinition(definition: { content: LegacyContent }) {
  const byObject: Record<string, unknown> = {};
  const tracksByObject: Record<string, unknown> = {};
  for (const instance of definition.content.instances) {
    byObject[instance.id] = legacyValues(instance);
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
