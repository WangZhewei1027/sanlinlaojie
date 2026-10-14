import assert from "node:assert/strict";
import { PerspectiveCamera } from "three";
import { draggedClipStart, groundPlacement } from "@/lib/scene/editor-interactions";
import { sceneDockLayout } from "@/lib/scene/dock-layout";

assert.equal(draggedClipStart(2, 100, 1000, 10), 3);
assert.equal(draggedClipStart(2, 100, 2000, 10), 2.5, "zoom keeps the time/pixel ratio");
assert.equal(draggedClipStart(2, -1000, 1000, 10), 0);
assert.equal(draggedClipStart(2, 9999, 1000, 10), 10);
assert.equal(draggedClipStart(1, 9999, 1000, 10.01), 10.01, "fractional duration clamps after snapping");
assert.equal(draggedClipStart(2, 0, 1000, 10), 2, "grabbing a clip does not jump its start");
assert.equal(draggedClipStart(2, 123, 0, 10), 2);
const camera = new PerspectiveCamera(45, 1, .01, 2000);
camera.position.set(0, 10, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
assert.deepEqual(groundPlacement(camera, {left:100,top:50,width:600,height:600},400,350), [0,0,0]);
const right = groundPlacement(camera, {left:100,top:50,width:600,height:600},500,350)!;
assert.ok(right[0] > 0 && right[1] === 0, "drop is projected through the current camera");
camera.lookAt(0,20,10); camera.updateMatrixWorld();
assert.equal(groundPlacement(camera, {left:0,top:0,width:600,height:600},300,300), null, "sky drops are rejected");
for (const width of [801,1024,1359,1440,2560]) for (const height of [280,500,818]) for (const size of [0,232,10000]) {
  const {panels:p} = sceneDockLayout(width,height,{left:size,right:size,bottom:size});
  assert.equal(p.objects.w + p.scene.w + p.inspector.w,width);
  assert.equal(p.scene.x,p.objects.w);
  assert.equal(p.inspector.x,p.scene.x+p.scene.w);
  assert.equal(p.timeline.y,p.scene.h);
  assert.equal(p.timeline.h+p.scene.h,height);
  assert.ok(p.scene.w >= 240 && p.scene.h > 0 && p.timeline.h > 0, "all docks stay usable at size limits");
}
console.log("PASS drag offset, frame snapping, zoom, bounds, ground projection and dock geometry");
