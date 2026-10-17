/**
 * Content model — client-safe request/response contracts.
 *
 * Single source of truth for the team asset / scene / placement APIs described
 * in docs/team-assets-scenes-refactor-plan.md §7 and the team workbench
 * contract (docs/team-workbench-backend-contract.md). Pure types and
 * constants: no server imports, safe in Client Components.
 *
 * Team model: the organization (UI: 团队) owns assets and scenes directly and
 * is the only permission boundary. Workspace rows are map collections that
 * own placements. CollectionDto describes this ownership.
 *
 * Conventions
 * - Success: `{ data: T }` (lists may add `page`). Response rows are snake_case.
 * - Failure: `{ error: string, code: ContentErrorCode, details?: … }` with the
 *   HTTP status listed on each code in CONTENT_ERROR_STATUS.
 * - Requests are camelCase JSON. Every mutation of a lockable row carries
 *   `expectedLockVersion` (missing → 428 LOCK_VERSION_REQUIRED, stale → 409
 *   LOCK_VERSION_CONFLICT). Commands that create content accept an
 *   `idempotencyKey`; replaying the same key with the same body returns the
 *   first result (`created: false`), a different body returns 409.
 * - Capability flags are computed server-side from the real authorization
 *   rules; UI must render from them instead of re-deriving roles.
 * - Timestamps are ISO strings. IDs are UUID strings.
 */

// ───────────────────────── protocol constants ─────────────────────────

export type ContentErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "LOCK_VERSION_REQUIRED"
  | "LOCK_VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "ARCHIVED"
  | "DEPENDENCY_CONFLICT"
  | "RECEIPT_INVALID"
  | "UNMANAGED_URL"
  | "RATE_LIMITED"
  | "INTERNAL";

export const CONTENT_ERROR_STATUS: Record<ContentErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  LOCK_VERSION_REQUIRED: 428,
  LOCK_VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  ARCHIVED: 409,
  DEPENDENCY_CONFLICT: 409,
  RECEIPT_INVALID: 400,
  UNMANAGED_URL: 400,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export interface ApiSuccess<T> {
  data: T;
}

export interface PageInfo {
  limit: number;
  offset: number;
  total: number;
}

export interface ApiPage<T> {
  data: T[];
  page: PageInfo;
}

export interface ApiErrorBody {
  error: string;
  code: ContentErrorCode;
  details?: ApiErrorDetails;
}

export interface ApiErrorDetails {
  /** LOCK_VERSION_CONFLICT: the server's current lock version. */
  current_lock_version?: number;
  /** VALIDATION_FAILED: per-path issues (scene documents, payloads). */
  issues?: { path: string; message: string }[];
  /** DEPENDENCY_CONFLICT / archive: what still depends on the object. */
  impact?: DependencyImpact;
}

// ───────────────────────── shared enums ─────────────────────────

/** Descriptive metadata only: every team member reads every asset of the team. */
export type AssetVisibility = "restricted" | "organization";
export type AssetState = "active" | "archived";
export type AssetOrigin = "team_upload" | "public_submission" | "legacy";
export type SceneState = "active" | "archived";
export type PlacementStatus = "draft" | "active" | "paused" | "archived";
/** Derived from draft lock + revisions, never stored (plan §4.3). */
export type ScenePublishStatus = "unpublished" | "published" | "modified" | "archived";

/** Media types an asset version can carry. `scene` lives in its own table. */
export type AssetFileType = "image" | "video" | "audio" | "document" | "model" | "text" | "link" | "shop" | "anchor";
export const ASSET_FILE_TYPES: readonly AssetFileType[] = ["image", "video", "audio", "document", "model", "text", "link", "shop", "anchor"];
/** Business objects with dedicated panels; excluded from generic pickers unless requested. */
export const SPECIAL_ASSET_FILE_TYPES: readonly AssetFileType[] = ["anchor", "shop"];

/** Role of one physical file inside a version. */
export type ResourceRole = "primary" | "thumbnail" | "checkin" | "audio_compat" | "reference";
export const RESOURCE_ROLES: readonly ResourceRole[] = ["primary", "thumbnail", "checkin", "audio_compat", "reference"];

export type UploadPurpose = "asset_version";

// ───────────────────────── capabilities ─────────────────────────

/** Capabilities on one map collection (a workspace row). */
export interface CollectionCapabilities {
  /** Every team member. */
  can_read: boolean;
  /** Team writer and the collection/organization are open: placements, tags, rename. */
  can_edit: boolean;
  /** Team writer in an open organization: archive and restore. */
  can_archive: boolean;
}

export interface AssetCapabilities {
  can_read: boolean;
  /** Team writer (owner/admin/member) in an open organization: name, versions, archive, restore. */
  can_maintain: boolean;
  /** Owner/admin only: change the responsible maintainer. */
  can_transfer_maintainer: boolean;
  /** Present when the request named a target collection (`usable_in`): writer, open collection, active asset. */
  can_use_in_workspace?: boolean;
}

export interface SceneCapabilities {
  can_read: boolean;
  can_edit: boolean;
  can_publish: boolean;
  can_archive: boolean;
}

export interface PlacementCapabilities {
  can_read: boolean;
  can_edit: boolean;
  /** Copy the fixed content to a collection. */
  can_copy: boolean;
}

// ───────────────────────── organization / map collections ─────────────────────────

/**
 * A map collection (stored as a workspace row). Placements belong to exactly
 * one collection; assets and scenes do not.
 */
export interface CollectionDto {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  create_date: string | null;
  archived_at: string | null;
  capabilities: CollectionCapabilities;
}

export type CollectionState = "active" | "archived" | "all";

/**
 * GET  /api/organizations/[id]/collections?state=active|archived|all (default active) → { data: CollectionDto[] }
 * POST /api/organizations/[id]/collections CreateCollectionRequest → 201 { data: CollectionDto }
 */
export interface CreateCollectionRequest {
  name: string;
  description?: string | null;
}

/**
 * GET   /api/collections/[id] → { data: CollectionDto }
 * PATCH /api/collections/[id] UpdateCollectionRequest → { data: CollectionDto }
 * POST  /api/collections/[id]/archive → archive; DELETE … → restore → { data: CollectionDto }
 * Archiving never changes team assets or scenes; it makes the collection's
 * placements read-only and stops their public entries.
 */
export interface UpdateCollectionRequest {
  name?: string;
  description?: string | null;
}

// ───────────────────────── uploads ─────────────────────────

export interface UploadReceiptDto {
  id: string;
  organization_id: string;
  /** Collection named by the upload, if any; receipts are organization-bound. */
  workspace_id: string | null;
  storage_key: string;
  url: string;
  content_hash: string;
  mime_type: string | null;
  size_bytes: number;
  purpose: UploadPurpose;
  /** True when an identical managed object already existed and was reused. */
  reused: boolean;
  expires_at: string;
}

/**
 * POST /api/upload (multipart: file, type?, organization_id and/or workspace_id, purpose?).
 * The organization comes from the database, never from the form alone: the
 * caller must be a team writer, and a given workspace_id must be an open
 * collection of that organization. Every upload returns a receipt.
 */
export interface UploadResponse {
  url: string;
  contentHash: string;
  storagePath: string | null;
  data: UploadReceiptDto;
}

// ───────────────────────── asset versions ─────────────────────────

/** Capture metadata: provenance only, never triggers a placement. */
export interface CaptureMetadata {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  source?: string;
  captured_at?: string;
}

export interface ModelAnimationInfo {
  index: number;
  name: string;
  duration_seconds?: number;
}

/** Scalar-only intrinsic attributes (dimensions and durations). */
export type PayloadScalar = string | number | boolean | null;
export type PayloadAttributes = Record<string, PayloadScalar>;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface PayloadBase {
  /** Intrinsic, file-independent attributes; no managed file URLs allowed. */
  attributes?: PayloadAttributes;
  capture?: CaptureMetadata;
}

export type AssetVersionPayload =
  | (PayloadBase & { kind: "image" })
  | (PayloadBase & { kind: "video" })
  | (PayloadBase & { kind: "audio" })
  | (PayloadBase & { kind: "document" })
  | (PayloadBase & { kind: "model"; animations?: ModelAnimationInfo[] })
  | (PayloadBase & { kind: "text"; text: string })
  | (PayloadBase & { kind: "link"; url: string; title?: string; description?: string; preview?: Record<string, PayloadScalar> })
  | (PayloadBase & { kind: "shop"; text?: string; name?: string })
  | (PayloadBase & { kind: "anchor"; text?: string });

export const ASSET_PAYLOAD_SCHEMA_VERSION = 1;

export interface AssetVersionResourceDto {
  role: ResourceRole;
  ordinal: number;
  storage_key: string | null;
  external_url: string | null;
  /** Resolved public URL (managed key → media host, or the external URL). */
  url: string;
  managed: boolean;
  content_hash: string | null;
  mime_type: string | null;
  size_bytes: number | null;
}

export interface AssetVersionDto {
  id: string;
  asset_id: string;
  organization_id: string;
  version_no: number;
  payload_schema_version: number;
  payload: AssetVersionPayload;
  resources: AssetVersionResourceDto[];
  created_by: string | null;
  created_at: string;
}

/** One file of a new version. Managed files must come from an upload receipt or an existing version. */
export type ResourceInput =
  | { role: ResourceRole; ordinal?: number; receiptId: string }
  | { role: ResourceRole; ordinal?: number; fromVersionId: string; fromRole: ResourceRole; fromOrdinal?: number }
  | { role: ResourceRole; ordinal?: number; externalUrl: string };

/** POST /api/assets/[id]/versions → { data: CreateVersionResult } */
export interface CreateAssetVersionRequest {
  payload: AssetVersionPayload;
  resources: ResourceInput[];
  idempotencyKey: string;
  /** Optional optimistic guard on the asset identity row. */
  expectedLockVersion?: number;
}

export interface CreateVersionResult {
  asset: AssetDto;
  version: AssetVersionDto;
  created: boolean;
}

// ───────────────────────── assets ─────────────────────────

export interface UserRefDto {
  user_id: string;
  name: string | null;
  email: string | null;
}

export interface AssetDto {
  id: string;
  organization_id: string;
  name: string | null;
  file_type: AssetFileType;
  origin: AssetOrigin;
  /** Metadata only (new assets: `organization`). */
  visibility: AssetVisibility;
  state: AssetState;
  /** Collection the asset was first uploaded from, if any (metadata). */
  origin_workspace_id: string | null;
  /** Responsible person (metadata); does not restrict editing. */
  maintained_by: string | null;
  maintainer: UserRefDto | null;
  current_version_id: string | null;
  current_version_no: number | null;
  /** Primary resource of the current version (catalog thumbnails only). */
  current_version: AssetVersionDto | null;
  lock_version: number;
  created_by: string | null;
  create_at: string | null;
  updated_at: string;
  archived_at: string | null;
  /** Visible + restricted dependency count (drafts, revisions, placements). */
  usage_count: number;
  capabilities: AssetCapabilities;
}

/**
 * GET /api/organizations/[id]/assets        team catalog
 * GET /api/collections/[id]/assets           the same team catalog,
 *   with `usable_in` fixed to that collection
 *   ?view=all|shared|maintained  (default all; every member; shared = visibility
 *     "organization", maintained = maintained by me — metadata filters only)
 *   ?q=&file_type=&origin=&state=active|archived|all&usable_in=<workspaceId>&limit=&offset=
 * → ApiPage<AssetDto>
 */
export interface AssetListQuery {
  view?: "shared" | "maintained" | "all";
  q?: string;
  file_type?: AssetFileType;
  origin?: AssetOrigin;
  state?: AssetState | "all";
  usable_in?: string;
  limit?: number;
  offset?: number;
}

/** Fields of a placement created together with the asset ("upload and place"). */
export interface PlacementFieldsInput {
  name?: string;
  location?: GeoPointInput | null;
  anchorId?: string | null;
  renderConfig?: PlacementRenderConfig;
  status?: PlacementStatus;
  tagIds?: string[];
}

/**
 * POST /api/collections/[id]/assets
 * → 201 { data: CreateAssetResult }; replay → 200 with created=false.
 * Team asset whose origin is that collection; `placement` places it there.
 */
export interface CreateAssetRequest {
  name: string;
  fileType: AssetFileType;
  payload: AssetVersionPayload;
  resources: ResourceInput[];
  /** Metadata only; defaults to `organization`. */
  visibility?: AssetVisibility;
  idempotencyKey: string;
  /** Optional one-step placement in the same collection. */
  placement?: PlacementFieldsInput;
}

/**
 * POST /api/organizations/[id]/assets → 201 { data: CreateAssetResult } (placement null);
 * replay → 200 with created=false. Needs no collection.
 */
export type CreateOrganizationAssetRequest = Omit<CreateAssetRequest, "placement">;

export interface CreateAssetResult {
  asset: AssetDto;
  version: AssetVersionDto;
  placement: PlacementDto | null;
  created: boolean;
}

/** GET /api/assets/[id] */
export interface AssetDetailDto extends AssetDto {
  versions: AssetVersionDto[];
}

/** PATCH /api/assets/[id] → { data: AssetDto } (any team writer) */
export interface UpdateAssetRequest {
  expectedLockVersion: number;
  name?: string;
  /** Metadata only. */
  visibility?: AssetVisibility;
  /** `active` restores an archived asset; archiving is DELETE. */
  state?: AssetState;
  /** Owner/admin only; null clears the responsible maintainer. */
  maintainedBy?: string | null;
}

/** DELETE /api/assets/[id]?expectedLockVersion=N → archive. */
export interface ArchiveAssetResult {
  asset: AssetDto;
  impact: DependencyImpact;
}

/** POST /api/assets/[id]/duplicate → 201 { data: CreateAssetResult } ("另存素材副本") */
export interface DuplicateAssetRequest {
  /** Optional origin collection (metadata, must be an open collection of the team); omit for a team-owned copy. */
  targetWorkspaceId?: string;
  name?: string;
  /** Defaults to the current version. */
  sourceVersionId?: string;
  idempotencyKey: string;
}

export interface DependencyImpact {
  drafts: number;
  revisions: number;
  placements: number;
  /** Every same-team dependency. */
  items: DependencyItem[];
  /** Always 0: team members see every dependency of a team asset. */
  restricted_count: number;
}

/** Scene items carry the scene's origin collection (null for team scenes); placements their collection. */
export type DependencyItem =
  | { kind: "scene_draft"; scene_id: string; scene_name: string; workspace_id: string | null; workspace_name: string | null; resource_alias: string; asset_version_id: string; version_no: number }
  | { kind: "scene_revision"; scene_id: string; scene_name: string; scene_revision_id: string; revision_no: number; workspace_id: string | null; workspace_name: string | null; resource_alias: string; asset_version_id: string; version_no: number }
  | { kind: "placement"; placement_id: string; placement_name: string | null; status: PlacementStatus; workspace_id: string; workspace_name: string; asset_version_id: string; version_no: number };

/** GET /api/assets/[id]/usage → { data: AssetUsageDto } */
export interface AssetUsageDto {
  asset_id: string;
  current_version_id: string | null;
  impact: DependencyImpact;
}

// ───────────────────────── scenes ─────────────────────────

/** Internal schema 3: every alias is pinned to an explicit version. */
export interface VersionedAssetRef {
  assetId: string;
  assetVersionId: string;
}

export interface SceneRevisionSummaryDto {
  id: string;
  scene_id: string;
  revision_no: number;
  source_lock_version: number;
  name: string;
  created_by: string | null;
  created_at: string;
  placement_count: number;
}

export interface SceneSummaryDto {
  id: string;
  organization_id: string;
  /** Origin collection (metadata only); null for team scenes. */
  workspace_id: string | null;
  name: string;
  state: SceneState;
  lock_version: number;
  publish_status: ScenePublishStatus;
  latest_revision: SceneRevisionSummaryDto | null;
  placement_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  capabilities: SceneCapabilities;
}

/** Resource pinned by the draft, resolved by version (never by the asset's current URL). */
export interface SceneResolvedResourceDto {
  resource_alias: string;
  asset_id: string;
  asset_version_id: string;
  version_no: number;
  asset_name: string | null;
  file_type: AssetFileType;
  asset_state: AssetState;
  url: string | null;
  animations: ModelAnimationInfo[];
  current_version_id: string | null;
  current_version_no: number | null;
  upgrade_available: boolean;
}

/** GET /api/scenes/[id] → { data: SceneDetailDto } */
export interface SceneDetailDto extends SceneSummaryDto {
  /** schemaVersion 3 document (see lib/scene/protocol.ts SceneDocumentV3). */
  draft_document: SceneDocumentV3Json;
  referenced_resources: SceneResolvedResourceDto[];
}

/** Structural JSON shape of schemaVersion 3; validated server-side. */
export interface SceneDocumentV3Json {
  schemaVersion: 3;
  content: {
    kind: "composition";
    units: "meters";
    durationSeconds: number | null;
    loop: boolean;
    assets: Record<string, VersionedAssetRef>;
    instances: unknown[];
  };
}

/**
 * POST /api/organizations/[id]/scenes → 201 { data: SceneDetailDto } (team scene)
 * GET  /api/organizations/[id]/scenes?state=active|archived|all (default all) → { data: SceneSummaryDto[] }
 */
export interface CreateSceneRequest {
  name: string;
  /** Optional import; schema 1/2 imports must be converted by the client first. */
  document?: SceneDocumentV3Json;
  idempotencyKey?: string;
}

/**
 * PATCH /api/scenes/[id] → { data: SceneDetailDto }
 * Saves the draft (document is the only editable source of references) and/or
 * archives/restores. expectedLockVersion is mandatory.
 */
export interface SaveSceneRequest {
  expectedLockVersion: number;
  name?: string;
  document?: SceneDocumentV3Json;
  state?: SceneState;
}

/** POST /api/scenes/[id]/publish → { data: PublishSceneResult } (201 when created) */
export interface PublishSceneRequest {
  expectedLockVersion: number;
  /**
   * "Publish and update current placements": switch these placements of this
   * scene to the new revision, each guarded by its own lock version.
   */
  updatePlacements?: { placementId: string; expectedLockVersion: number }[];
}

export interface PublishSceneResult {
  revision: SceneRevisionSummaryDto;
  created: boolean;
  updated_placements: PlacementDto[];
}

/** POST /api/scenes/[id]/copy → 201 { data: SceneDetailDto } (always inside the same team) */
export interface CopySceneRequest {
  /** Optional origin collection (metadata, must be an open collection of the team); omit for a team scene. */
  targetWorkspaceId?: string;
  name?: string;
  idempotencyKey?: string;
}

// GET /api/scenes/[id]/revisions → { data: SceneRevisionSummaryDto[] }

// ───────────────────────── placements ─────────────────────────

export interface GeoPointInput {
  longitude: number;
  latitude: number;
  /** Meters; kept as an explicit column, not in render_config. */
  altitude?: number | null;
}

export interface GeoPointDto {
  longitude: number;
  latitude: number;
  altitude: number | null;
}

/**
 * Local presentation overrides, validated per type. `config` holds scale and
 * text style; `display` holds playback settings (volume, auto, loop). Scalars only.
 */
export interface PlacementRenderConfig {
  is_huge?: boolean;
  config?: Record<string, PayloadScalar>;
  display?: Record<string, PayloadScalar>;
}

export type PlacementTargetInput =
  | { kind: "asset_version"; assetVersionId: string }
  | { kind: "scene_revision"; sceneRevisionId: string };

export type PlacementTargetDto =
  | {
      kind: "asset_version";
      asset_id: string;
      asset_version_id: string;
      version_no: number;
      asset_name: string | null;
      file_type: AssetFileType;
      asset_state: AssetState;
      current_version_id: string | null;
      upgrade_available: boolean;
    }
  | {
      kind: "scene_revision";
      scene_id: string;
      scene_revision_id: string;
      revision_no: number;
      scene_name: string;
      /** Scene's origin collection; null for team scenes. */
      scene_workspace_id: string | null;
      scene_state: SceneState;
      latest_revision_id: string | null;
      upgrade_available: boolean;
    };

export interface PlacementDto {
  id: string;
  organization_id: string;
  workspace_id: string;
  workspace_name: string | null;
  name: string | null;
  target: PlacementTargetDto;
  location: GeoPointDto | null;
  anchor_id: string | null;
  render_config: PlacementRenderConfig;
  status: PlacementStatus;
  lock_version: number;
  tag_ids: string[];
  /** The placement ID used by the mini-program. */
  public_id: string;
  /** No GPS/anchor discovery; listed by the shops endpoint only. */
  directory_only: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  capabilities: PlacementCapabilities;
}

/**
 * GET /api/collections/[id]/placements?status= → { data: PlacementDto[] }
 * GET /api/organizations/[id]/placements → { data: PlacementDto[] } (every collection of the team)
 */

/**
 * POST /api/collections/[id]/placements → 201 { data: CreatePlacementResult }
 * Any same-team AssetVersion or SceneRevision can be placed into any open
 * collection; a scene is never copied to be placed in another collection.
 */
export type CreatePlacementRequest =
  | (PlacementFieldsInput & { target: PlacementTargetInput; idempotencyKey?: string })
  | (PlacementFieldsInput & { asset: Omit<CreateAssetRequest, "placement" | "idempotencyKey">; idempotencyKey: string });

export interface CreatePlacementResult {
  placement: PlacementDto;
  /** Present for the upload-and-place form. */
  asset: AssetDto | null;
  version: AssetVersionDto | null;
  created: boolean;
}

/** PATCH /api/placements/[id] → { data: PlacementDto } */
export interface UpdatePlacementRequest {
  expectedLockVersion: number;
  name?: string | null;
  location?: GeoPointInput | null;
  anchorId?: string | null;
  renderConfig?: PlacementRenderConfig;
  status?: PlacementStatus;
  /** Upgrade/rollback within the same asset or scene. */
  target?: PlacementTargetInput;
  tagIds?: string[];
}

// DELETE /api/placements/[id]?expectedLockVersion=N → archive → { data: PlacementDto }

/**
 * GET /api/placements/[id]/content?workspace_id=<viewer collection>
 * → { data: PlacementContentDto }
 *
 * Fixed playable content of one placement for preview, authorized exactly
 * like GET /api/placements/[id]: team membership of the placement's
 * organization. An explicit workspace_id must be the owning collection. Returns only what the placement pins — never version history,
 * the asset's current version, grants, drafts or catalog data — and grants
 * nothing for reuse. Unreadable placements are 404.
 */
export type PlacementContentDto = PlacementAssetContentDto | PlacementSceneContentDto;

export interface PlacementAssetContentDto {
  kind: "asset_version";
  placement_id: string;
  public_id: string;
  asset_id: string;
  asset_version_id: string;
  version_no: number;
  file_type: AssetFileType;
  /** The pinned version's payload (immutable content). */
  payload: AssetVersionPayload;
  resources: AssetVersionResourceDto[];
}

export interface PlacementSceneContentDto {
  kind: "scene_revision";
  placement_id: string;
  public_id: string;
  scene_id: string;
  scene_revision_id: string;
  revision_no: number;
  name: string;
  /** Frozen schema-3 document of the revision. */
  document: SceneDocumentV3Json;
  /** One entry per alias, resolved from the pinned version's own files. */
  resources: PinnedSceneResourceDto[];
}

export interface PinnedSceneResourceDto {
  resource_alias: string;
  asset_id: string;
  asset_version_id: string;
  version_no: number;
  file_type: AssetFileType;
  url: string | null;
  animations: ModelAnimationInfo[];
}

/** POST /api/placements/move → { data: PlacementDto[] } (all-or-nothing) */
export interface MovePlacementsRequest {
  moves: { placementId: string; expectedLockVersion: number; longitude: number; latitude: number; altitude?: number | null }[];
}

/** POST /api/placements/[id]/copy → 201 { data: CreatePlacementResult } */
export interface CopyPlacementRequest {
  /** Defaults to the source workspace. */
  targetWorkspaceId?: string;
  offsetMeters?: number;
  location?: GeoPointInput | null;
  name?: string;
  idempotencyKey?: string;
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && typeof (value as ApiErrorBody).error === "string" && typeof (value as ApiErrorBody).code === "string";
}
