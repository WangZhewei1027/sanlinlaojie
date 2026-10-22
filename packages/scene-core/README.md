# Scene Core

Dependency-free transform sampling and playback shared by Web and WeChat. The host owns
rendering, assets and frame scheduling. Each `createSceneCore({content})` call creates an
independent player, without a global registry, DOM, timers, RAF or dynamic code execution.

`position`, Euler XYZ `rotation` (radians) and `scale` use optional numeric tracks. Each key
has a time, value, incoming/outgoing Bezier handles and `connectedRight` (false holds until
the next key). Linear handles produce linear interpolation. Exact keys return exact values.
No tracks means the instance's static transform. The editor displays rotation in degrees.
Optional `groups` share the instance ID space and are sampled the same way; values are local
to the parent group, and hosts build the Object3D hierarchy from each node's `parent`.

Use `play`, `pause`, `seek`, `advance(seconds)`, `sync(content)`, `sample(id)` and
`bind(id, object3D)`. `dispose` stops playback and clears all callbacks and object bindings.
GLB clips remain Three.AnimationMixer's responsibility; `clipTime` shares their time mapping.
Scene documents must pass the server validator before playback. Audio, script execution,
editor undo, asset fetch and AR tracking are intentionally outside this small package.

Update the mini-program snapshot from the Web repository:

```sh
npm pack ./packages/scene-core --pack-destination ../xr-frame-plant-trees/vendor
cd ../xr-frame-plant-trees
npm install --ignore-scripts ./vendor/spatial-memory-scene-core-2.1.0.tgz
npm run build:scene-core
npm run test:scene-memory
```

Web `scripts/test-scene-playback-parity.ts` compares the actual Web adapter and mini player,
including GLB animation matrices. Migration fixtures preserve samples from the retired
engine; live runtime and authoring never load that dependency or its document format.
