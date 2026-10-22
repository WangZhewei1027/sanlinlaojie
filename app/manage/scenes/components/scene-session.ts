import { createSceneCore } from "@spatial-memory/scene-core";
import type { CompositionContent } from "@/lib/scene/protocol";
/** Each mounted editor owns one disposable player; no global project registry. */
export function createSceneSession(definition: { content: CompositionContent }) {
  return createSceneCore({ content: definition.content });
}
export type SceneSession = ReturnType<typeof createSceneSession>;
