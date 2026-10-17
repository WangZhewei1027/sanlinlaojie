/**
 * Scene document helpers for the v2 editor.
 *
 * The editor keeps the composition/instances/tracks model unchanged; schema 3
 * only widens each resource alias to a pinned `{ assetId, assetVersionId }`.
 * Structural validation reuses lib/scene by projecting the document onto the
 * schema-2 shape (alias → assetId), so limits, ids and tracks stay checked the
 * same way, while the pinned versions are carried through untouched. The
 * server re-validates ownership, versions and clips on save and publish.
 */
import { parseSceneText } from "@/lib/scene/validate";
import type { CompositionContent, InstanceAnimation, SceneDefinition } from "@/lib/scene/protocol";
import type { ModelAnimationInfo, SceneDocumentV3Json, VersionedAssetRef } from "@/lib/content-model/contracts";

export interface EditorAssetRef {
  assetId: string;
  /** Always present in schema 3; absent only in legacy (asset-backed) scenes. */
  assetVersionId?: string;
}

export interface EditorDefinition {
  schemaVersion: 1 | 2 | 3;
  content: Omit<CompositionContent, "assets"> & { assets: Record<string, EditorAssetRef> };
}

/** View for Theatre and lib/scene helpers, which only read instances, tracks and duration. */
export function theatreView(definition: EditorDefinition): SceneDefinition {
  return definition as unknown as SceneDefinition;
}

function projection(definition: EditorDefinition): SceneDefinition {
  const assets = Object.fromEntries(Object.entries(definition.content.assets).map(([alias, ref]) => [alias, { assetId: ref.assetId }]));
  return { schemaVersion: 2, content: { ...definition.content, assets } };
}

/**
 * Validate structure and normalize timing exactly as the legacy editor did
 * (an animated scene gets a finite duration), but keep the document's own
 * schema version and pinned references instead of forcing schema 2.
 */
export function normalizeDefinition(next: EditorDefinition): EditorDefinition {
  const content = next.content;
  const animated = content.instances.some((item) => item.animation || Object.values(item.tracks ?? {}).some((frames) => frames?.length));
  const durationSeconds = animated ? content.durationSeconds ?? 10 : content.durationSeconds;
  const parsed = parseSceneText(JSON.stringify(projection({ ...next, content: { ...content, durationSeconds } })));
  return { schemaVersion: next.schemaVersion, content: { ...parsed.content, assets: next.content.assets } };
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

/** Convert an imported schema 1/2 JSON (assetId only) by pinning each asset's current version. */
export async function pinLegacyDefinition(text: string, currentVersionOf: (assetId: string) => Promise<string>): Promise<SceneDocumentV3Json> {
  const legacy = parseSceneText(text);
  const pinned: EditorDefinition = { schemaVersion: 3, content: { ...legacy.content, assets: {} } };
  for (const [alias, ref] of Object.entries(legacy.content.assets)) {
    pinned.content.assets[alias] = { assetId: ref.assetId, assetVersionId: await currentVersionOf(ref.assetId) };
  }
  return toV3(normalizeDefinition(pinned));
}

/** Parse an import file that may already be schema 3. */
export function readSceneImport(text: string): { kind: "v3"; document: SceneDocumentV3Json } | { kind: "legacy"; text: string } {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return { kind: "legacy", text }; }
  if (value && typeof value === "object" && (value as { schemaVersion?: unknown }).schemaVersion === 3) {
    const document = value as SceneDocumentV3Json;
    return { kind: "v3", document: toV3(fromV3(document)) };
  }
  return { kind: "legacy", text };
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
