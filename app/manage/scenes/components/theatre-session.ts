import { getProject, types, type ISheetObject } from "@theatre/core";
import studio from "@theatre/studio";
import { type TransformValues } from "@/lib/scene/theatre-state";
import { type CompositionInstance, type SceneDocumentLike } from "@/lib/scene/protocol";
import { replaceTheatreSheet } from "@/lib/scene/theatre-authoring";
import { isOwner, release, runExclusive } from "./theatre-ownership";

export type TransformObject = ISheetObject<TransformValues>;
// This module is only loaded by the editor’s client-only dynamic import.
if (typeof window !== "undefined") {
  studio.initialize({ usePersistentStorage: false }); studio.ui.hide();
  studio.__experimental.__experimental_disblePlayPauseKeyboardShortcut();
}

/**
 * One object schema for every instance. Theatre rejects a second
 * `sheet.object(key, config)` whose config differs, so the schema must not
 * depend on per-load values: saved poses and tracks always arrive through the
 * imported sheet state (static overrides + sequence), never through defaults.
 */
const axis = (value: number, range: [number, number]) => types.number(value, { range, nudgeMultiplier: 0.01 });
const vector = (value: number, range: [number, number]) => ({ x: axis(value, range), y: axis(value, range), z: axis(value, range) });
const TRANSFORM_CONFIG = { position: vector(0, [-100, 100]), rotation: vector(0, [-100, 100]), scale: vector(1, [0.001, 100]) };

/** Object keys currently attached to each project's sheet, across sessions. */
const attached = new Map<string, Set<string>>();

/** Stable per scene and within Theatre's 32-character limit. */
export function theatreProjectId(sceneId: string) {
  return `Scene ${sceneId.replaceAll("-", "").slice(0, 24)}`;
}

export async function createTheatreSession(sceneId: string, definition: SceneDocumentLike) {
  const projectId = theatreProjectId(sceneId);
  try {
    return await runExclusive(projectId, async (owner) => {
      // No per-load project config: a second getProject with different state would throw.
      const project = getProject(projectId);
      await project.ready;
      const sheet = project.sheet("Scene");
      const keys = attached.get(projectId) ?? new Set<string>();
      attached.set(projectId, keys);
      const objects = new Map<string, TransformObject>();
      const add = (instance: CompositionInstance) => {
        const object = sheet.object(instance.id, TRANSFORM_CONFIG) as unknown as TransformObject;
        keys.add(instance.id);
        objects.set(instance.id, object);
        return object;
      };
      const detach = (id: string) => {
        if (keys.delete(id)) sheet.detachObject(id);
        objects.delete(id);
      };
      sheet.sequence.pause();
      // Earlier sessions of this scene may have left objects the new draft no longer has.
      for (const id of [...keys]) if (!definition.content.instances.some((instance) => instance.id === id)) detach(id);
      replaceTheatreSheet(project.address.projectId, definition);
      definition.content.instances.forEach(add);
      sheet.sequence.position = 0;
      return {
        project, sheet, objects, studio, add,
        /** False once a newer session of the same scene took over; a stale session must not write. */
        get live() { return isOwner(projectId, owner); },
        sync(next: SceneDocumentLike) {
          if (!isOwner(projectId, owner)) return;
          sheet.sequence.pause();
          replaceTheatreSheet(project.address.projectId, next);
          for (const id of [...objects.keys()]) if (!next.content.instances.some((instance) => instance.id === id)) detach(id);
          for (const instance of next.content.instances) if (!objects.has(instance.id)) add(instance);
          sheet.sequence.position = Math.min(sheet.sequence.position, next.content.durationSeconds ?? 10);
        },
        dispose() {
          objects.clear();
          if (!release(projectId, owner)) return;
          sheet.sequence.pause();
          for (const id of [...keys]) detach(id);
          studio.ui.hide();
        },
      };
    });
  } finally {
    // Theatre may reveal its studio overlay while reporting problems; the editor never shows it.
    studio.ui.hide();
  }
}
export type TheatreSession = Awaited<ReturnType<typeof createTheatreSession>>;
