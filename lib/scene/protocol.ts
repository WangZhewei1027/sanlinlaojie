export const SCENE_SCHEMA_VERSION = 4 as const;
export const SCENE_DOCUMENT_VERSION = 6 as const;
export const MAX_SCENE_BYTES = 1024 * 1024;

export interface CompositionAssetRef {
  assetId: string;
}

/** Scene alias referencing an asset identity. */
export interface AssetRef {
  assetId: string;
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
  /** Euler XYZ radians; UI displays degrees. Multi-turn values are retained. */
  rotation: [number, number, number];
  scale: [number, number, number];
  animation: InstanceAnimation | null;
  /** Numeric transform tracks, sampled by the shared platform-independent core. */
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
  schemaVersion: typeof SCENE_SCHEMA_VERSION;
  content: CompositionContent;
}

export interface SceneDocument {
  schemaVersion: typeof SCENE_DOCUMENT_VERSION;
  content: CompositionContent<AssetRef>;
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
export function createBlankSceneDocument(): SceneDocument {
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
 * Playback manifest compiled from a fixed Scene.
 * `assetId` is the discovered placement ID.
 */
export interface SceneAssetManifest extends SceneDefinition {
  assetId: string;
  resources: Record<string, { assetId: string; url: string }>;
}
