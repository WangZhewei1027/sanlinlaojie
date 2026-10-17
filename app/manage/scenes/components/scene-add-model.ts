import type { ScenePosition } from "@/lib/scene/editor-interactions";
import { COMPOSITION_LIMITS, type CompositionInstance } from "@/lib/scene/protocol";
import { newAlias, type EditorAssetRef, type EditorDefinition } from "../../lib/scene-v3";
import type { SceneMode, SceneResource } from "./types";

type Content = EditorDefinition["content"];
export type ModelAddFailure = "instanceLimit" | "assetLimit" | "archived" | "missing";

/** v2 resources are keyed by pinned version, so v1 and v2 of one asset coexist; legacy keys by asset. */
export function resourceKey(mode: SceneMode, ref: EditorAssetRef | undefined) {
  return mode === "v2" ? ref?.assetVersionId ?? "" : ref?.assetId ?? "";
}

/**
 * Adds one instance of `key` (pinned version id in v2, asset id in legacy).
 * Instances of the same key share one alias. A new v2 alias is pinned from
 * `resource`, which the caller passes explicitly: a model picked in the
 * library may not be in the editor's registered resources yet.
 */
export function addModelInstance(content: Content, { mode, key, resource, id, position, createAlias = newAlias }: {
  mode: SceneMode; key: string; resource: SceneResource | undefined; id: string; position: ScenePosition; createAlias?: () => string;
}): { ok: true; content: Content } | { ok: false; reason: ModelAddFailure } {
  if (content.instances.length >= COMPOSITION_LIMITS.maxInstances) return { ok: false, reason: "instanceLimit" };
  if (!key) return { ok: false, reason: "missing" };
  let alias = Object.keys(content.assets).find((name) => resourceKey(mode, content.assets[name]) === key);
  let assets = content.assets;
  if (!alias) {
    if (Object.keys(assets).length >= COMPOSITION_LIMITS.maxAssets) return { ok: false, reason: "assetLimit" };
    let ref: EditorAssetRef = { assetId: key };
    if (mode === "v2") {
      if (!resource || resource.assetVersionId !== key || !resource.url) return { ok: false, reason: "missing" };
      if (resource.assetState === "archived") return { ok: false, reason: "archived" };
      ref = { assetId: resource.assetId, assetVersionId: key };
    }
    alias = createAlias();
    assets = { ...assets, [alias]: ref };
  }
  const added: CompositionInstance = { id, asset: alias, position, quaternion: [0, 0, 0, 1], scale: [1, 1, 1], animation: null };
  return { ok: true, content: { ...content, instances: [...content.instances, added], assets } };
}
