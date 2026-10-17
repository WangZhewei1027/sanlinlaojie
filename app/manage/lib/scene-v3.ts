/** Pinned scene document helpers for the editor. */
import type { ModelAnimationInfo, SceneDocumentV3Json, VersionedAssetRef } from "@/lib/content-model/contracts";
import type { CompositionContent, InstanceAnimation } from "@/lib/scene/protocol";
import { parseSceneDocumentV3 } from "@/lib/scene/validate";

export interface EditorAssetRef {
  assetId: string;
  assetVersionId: string;
}

export interface EditorDefinition {
  schemaVersion: 3;
  content: Omit<CompositionContent, "assets"> & { assets: Record<string, EditorAssetRef> };
}

/** Validate the pinned document and give animated content a finite duration. */
export function normalizeDefinition(next: EditorDefinition): EditorDefinition {
  const content = next.content;
  const animated = content.instances.some((item) => item.animation || Object.values(item.tracks ?? {}).some((frames) => frames?.length));
  const durationSeconds = animated ? content.durationSeconds ?? 10 : content.durationSeconds;
  return parseSceneDocumentV3({ ...next, content: { ...content, durationSeconds } });
}

export function fromV3(document: SceneDocumentV3Json): EditorDefinition {
  const definition: EditorDefinition = {
    schemaVersion: 3,
    content: { ...(document.content as unknown as CompositionContent), assets: { ...document.content.assets } },
  };
  return normalizeDefinition(definition);
}

export class UnpinnedReferenceError extends Error {
  constructor(readonly alias: string) {
    super(`Resource alias "${alias}" is not pinned to a version`);
    this.name = "UnpinnedReferenceError";
  }
}

export function toV3(definition: EditorDefinition): SceneDocumentV3Json {
  const assets: Record<string, VersionedAssetRef> = {};
  for (const [alias, ref] of Object.entries(definition.content.assets)) {
    if (!ref.assetVersionId) throw new UnpinnedReferenceError(alias);
    assets[alias] = { assetId: ref.assetId, assetVersionId: ref.assetVersionId };
  }
  const { kind, units, durationSeconds, loop, instances } = definition.content;
  return { schemaVersion: 3, content: { kind, units, durationSeconds, loop, assets, instances } };
}

/** Imports use the same pinned schema as saved drafts. */
export function readSceneImport(text: string): SceneDocumentV3Json {
  return toV3(fromV3(parseSceneDocumentV3(JSON.parse(text))));
}

export function newAlias() {
  return `m${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/** Name of the clip the animation needs that `animations` does not provide, or null when compatible. */
export function missingClip(animation: InstanceAnimation | null | undefined, animations: ModelAnimationInfo[] | undefined): string | null {
  if (!animation || !animations) return null;
  if (animation.clipIndex !== undefined) {
    return animations.some((clip) => clip.index === animation.clipIndex) ? null : `#${animation.clipIndex + 1}`;
  }
  if (animation.clipName !== undefined) {
    return animations.filter((clip) => clip.name === animation.clipName).length === 1 ? null : animation.clipName;
  }
  return null;
}
