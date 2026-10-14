import { Plane, Raycaster, Vector2, Vector3, type Camera } from "three";
import { COMPOSITION_LIMITS } from "./protocol";
import { snapTime } from "./editor-document";

export const MODEL_DRAG_TYPE = "application/x-scene-model-asset";
export type ScenePosition = [number, number, number];
export type PlacementReader = (x: number, y: number) => ScenePosition | null;

/** Project a viewport pointer onto the scene ground, without accepting sky/out-of-range drops. */
export function groundPlacement(camera: Camera, rect: { left: number; top: number; width: number; height: number }, x: number, y: number): ScenePosition | null {
  if (!rect.width || !rect.height) return null;
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), camera);
  const hit = ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), new Vector3());
  if (!hit || ![hit.x, hit.z].every((value) => Number.isFinite(value) && Math.abs(value) <= COMPOSITION_LIMITS.maxPositionAbs)) return null;
  return [Math.round(hit.x * 1000) / 1000, 0, Math.round(hit.z * 1000) / 1000];
}

/** Offset-based dragging preserves the grabbed point, including at timeline zoom levels. */
export function draggedClipStart(start: number, deltaPixels: number, laneWidth: number, duration: number) {
  if (laneWidth <= 0) return start;
  return Math.min(duration, Math.max(0, snapTime(start + deltaPixels / laneWidth * duration)));
}
