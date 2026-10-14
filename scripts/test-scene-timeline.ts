import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { getProject } from "@theatre/core";
import { stateFromDefinition, instanceValues } from "@/lib/scene/theatre-state";
import { createBlankScene, type TransformKeyframe } from "@/lib/scene/protocol";
import { parseSceneText, validateSceneDefinition } from "@/lib/scene/validate";
const require = createRequire(import.meta.url);
const { sampleTrack } = require("../../xr-frame-plant-trees/miniprogram/lib/scene-runtime/transform-tracks.js");
const definition = createBlankScene();
assert.deepEqual(parseSceneText(JSON.stringify(definition)), definition);
definition.content.assets = { model: { assetId: "11111111-1111-4111-8111-111111111111" } };
const frames: TransformKeyframe[] = [
  { time: 1, value: -2, handles: [0.5, 0.5, 0.1, 0.8], connectedRight: true },
  { time: 4, value: 6, handles: [0.9, 0.3, 0.5, 0.5], connectedRight: false },
  { time: 8, value: 3, handles: [0.5, 0.5, 0.5, 0.5], connectedRight: false },
];
const instance = { id: "dancer", asset: "model", position: [0, 0, 0] as [number, number, number], quaternion: [0, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as [number, number, number], animation: null, tracks: { "position.x": frames } };
definition.content.instances = [instance];
assert.equal(validateSceneDefinition(definition).ok, true);
const project = getProject("Timeline regression", { state: stateFromDefinition(definition) });
const sheet = project.sheet("Scene");
const object = sheet.object(instance.id, instanceValues(instance));
for (const time of [0, 1, 1.01, 1.25, 2, 2.1, 3, 3.99, 4, 7.5, 7.999, 8, 10]) {
  sheet.sequence.position = time;
  assert.ok(Math.abs(object.value.position.x - sampleTrack(frames, time)) < 0.002, `Theatre / mini-player differ at ${time}: ${object.value.position.x} vs ${sampleTrack(frames, time)}`);
}
assert.equal(sheet.sequence.__experimental_getKeyframes(object.props.position.x).length, 3);
for (const mutate of [
  (d: typeof definition) => { d.schemaVersion = 1; },
  (d: typeof definition) => { d.content.durationSeconds = null; },
  (d: typeof definition) => { d.content.instances[0].tracks!["position.x"]![1].time = 1; },
  (d: typeof definition) => { d.content.instances[0].tracks!["position.x"]![0].handles[2] = -1; },
  (d: typeof definition) => { d.content.instances[0].tracks!["scale.x"] = [{ ...frames[0], value: 0 }]; },
  (d: typeof definition) => { d.content.instances[0].tracks!["position.x"]![2].time = 11; },
]) { const invalid = structuredClone(definition); mutate(invalid); assert.equal(validateSceneDefinition(invalid).ok, false); }
console.log("PASS blank scene, Theatre editable-state round trip, Bezier/hold parity with mini-player, timeline bounds");
