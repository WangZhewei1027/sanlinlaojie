/**
 * Composition JSON. Schema 1/2 is the mini-program playback protocol (and the
 * legacy scene asset's text_content); schema 3 is the internal document of an
 * independent Scene whose aliases pin explicit asset versions. Schema 3 is
 * compiled to 2 for playback (lib/scene/compile.ts).
 */
export const SCENE_SCHEMA_VERSION = 2 as const;
export const SCENE_DOCUMENT_VERSION = 3 as const;
export const MAX_SCENE_BYTES = 256 * 1024;

export interface CompositionAssetRef {
  assetId: string;
}

/** Schema 3 alias: identity for upgrade UI + the version that decides content. */
export interface VersionedAssetRef {
  assetId: string;
  assetVersionId: string;
}

export interface InstanceAnimation {
  /** Zero-based index into the GLB's animations; exactly one of clipIndex / clipName. */
  clipIndex?: number;
  /** GLB animation name; only allowed when the name is unique in the file. */
  clipName?: string;
  startSeconds: number;
  loop: boolean;
}

export interface CompositionInstance {
  id: string;
  asset: string;
  position: [number, number, number];
  /** x, y, z, w — must be a unit quaternion */
  quaternion: [number, number, number, number];
  scale: [number, number, number];
  animation: InstanceAnimation | null;
  /** Theatre numeric channels; rotation is Euler XYZ in radians. Version 2 only. */
  tracks?: Partial<Record<TransformChannel, TransformKeyframe[]>>;
}

export const TRANSFORM_CHANNELS = ["position.x", "position.y", "position.z", "rotation.x", "rotation.y", "rotation.z", "scale.x", "scale.y", "scale.z"] as const;
export type TransformChannel = typeof TRANSFORM_CHANNELS[number];
export interface TransformKeyframe {
  time: number;
  value: number;
  handles: [number, number, number, number];
  connectedRight: boolean;
}

export interface CompositionContent<Ref = CompositionAssetRef> {
  kind: "composition";
  units: "meters";
  /** Finite positive, or null when no instance has an animation (static scene, never ends). */
  durationSeconds: number | null;
  loop: boolean;
  assets: Record<string, Ref>;
  instances: CompositionInstance[];
}

export interface SceneDefinition {
  schemaVersion: 1 | 2;
  content: CompositionContent;
}

export interface SceneDocumentV3 {
  schemaVersion: typeof SCENE_DOCUMENT_VERSION;
  content: CompositionContent<VersionedAssetRef>;
}

/** Anything with a composition timeline: authoring helpers accept every schema. */
export interface SceneDocumentLike {
  content: { durationSeconds: number | null; instances: CompositionInstance[] };
}

export const COMPOSITION_LIMITS = {
  maxAssets: 8,
  maxInstances: 24,
  maxDurationSeconds: 600,
  maxScale: 100,
  maxPositionAbs: 100,
  maxKeyframes: 2400,
} as const;

export function createBlankScene(): SceneDefinition {
  return { schemaVersion: SCENE_SCHEMA_VERSION, content: { kind: "composition", units: "meters", durationSeconds: 10, loop: false, assets: {}, instances: [] } };
}

/** Server factory for a new independent Scene draft (10 s, no loop, empty). */
export function createBlankSceneDocument(): SceneDocumentV3 {
  return { schemaVersion: SCENE_DOCUMENT_VERSION, content: { kind: "composition", units: "meters", durationSeconds: 10, loop: false, assets: {}, instances: [] } };
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

/**
 * Playback manifest returned to the mini-program. Legacy organizations resolve
 * it from current model rows; cut-over organizations compile it from a fixed
 * SceneRevision. `assetId` always echoes the requested discovery id.
 */
export interface SceneAssetManifest extends SceneDefinition {
  assetId: string;
  resources: Record<string, { assetId: string; url: string }>;
}
