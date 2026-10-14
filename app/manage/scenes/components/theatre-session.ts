import { getProject, types, type ISheetObject } from "@theatre/core";
import studio from "@theatre/studio";
import { instanceValues, stateFromDefinition, type TransformValues } from "@/lib/scene/theatre-state";
import { type CompositionInstance, type SceneDefinition } from "@/lib/scene/protocol";
import { replaceTheatreSheet } from "@/lib/scene/theatre-authoring";

export type TransformObject = ISheetObject<TransformValues>;
// This module is only loaded by the editor’s client-only dynamic import.
if (typeof window !== "undefined") {
  studio.initialize({ usePersistentStorage: false }); studio.ui.hide();
  studio.__experimental.__experimental_disblePlayPauseKeyboardShortcut();
}
export async function createTheatreSession(assetId: string, definition: SceneDefinition) {
  // Each editor is a separate browser document; keep the Theatre ID within its 32-character limit.
  const project = getProject(`Scene ${assetId.slice(0, 8)}`, { state: stateFromDefinition(definition) });
  await project.ready;
  const sheet = project.sheet("Scene");
  const objects = new Map<string, TransformObject>();
  const add = (instance: CompositionInstance) => {
    const defaults = instanceValues(instance);
    const vector = (group: keyof TransformValues) => Object.fromEntries(
      (["x", "y", "z"] as const).map((axis) => [axis, types.number(defaults[group][axis], { range: group === "scale" ? [0.001, 100] : [-100, 100], nudgeMultiplier: 0.01 })]),
    ) as { x: ReturnType<typeof types.number>; y: ReturnType<typeof types.number>; z: ReturnType<typeof types.number> };
    const object = sheet.object(instance.id, { position: vector("position"), rotation: vector("rotation"), scale: vector("scale") });
    objects.set(instance.id, object);
    return object;
  };
  definition.content.instances.forEach(add);
  studio.ui.hide();
  replaceTheatreSheet(project.address.projectId, definition);
  return {
    project, sheet, objects, studio, add,
    sync(next: SceneDefinition) {
      sheet.sequence.pause();
      replaceTheatreSheet(project.address.projectId, next);
      for (const id of objects.keys()) if (!next.content.instances.some((instance) => instance.id === id)) { sheet.detachObject(id); objects.delete(id); }
      for (const instance of next.content.instances) if (!objects.has(instance.id)) add(instance);
      sheet.sequence.position = Math.min(sheet.sequence.position, next.content.durationSeconds ?? 10);
    },
    dispose() { sheet.sequence.pause(); for (const id of objects.keys()) sheet.detachObject(id); objects.clear(); studio.ui.hide(); },
  };
}
export type TheatreSession = Awaited<ReturnType<typeof createTheatreSession>>;
