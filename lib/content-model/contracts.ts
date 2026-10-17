/**
 * Content model v2 — client-safe request/response contracts.
 *
 * Single source of truth for the team asset / scene / placement APIs described
 * in docs/team-assets-scenes-refactor-plan.md §7. Pure types and constants:
 * no server imports, safe in Client Components.
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
 * - Administrative writes to the *legacy* paths (`/api/assets/*`,
 *   `/api/workspaces/[id]/assets`, …) for an organization in state `v2` must
 *   send `X-Content-Model: 2`; otherwise 409 CONTENT_MODEL_UPGRADE_REQUIRED.
 *   New paths (`/api/scenes/*`, `/api/placements/*`, `/api/assets/[id]/versions`
 *   …) are v2 by definition and need no header.
 * - Capability flags are computed server-side from the real authorization
 *   rules; UI must render from them instead of re-deriving roles.
 * - Timestamps are ISO strings. IDs are UUID strings.
 */

// ───────────────────────── protocol constants ─────────────────────────

export const CONTENT_MODEL_HEADER = "X-Content-Model";
export const CONTENT_MODEL_VERSION = "2";

/** Per-organization cutover state (plan §8.1). */
export type ContentModelState = "legacy" | "preparing" | "readonly" | "v2";
export const CONTENT_MODEL_STATES: readonly ContentModelState[] = ["legacy", "preparing", "readonly", "v2"];

export type ContentErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "LOCK_VERSION_REQUIRED"
  | "LOCK_VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "CONTENT_MODEL_UPGRADE_REQUIRED"
  | "CONTENT_MODEL_NOT_ENABLED"
  | "CONTENT_MODEL_READONLY"
  | "ARCHIVED"
  | "DEPENDENCY_CONFLICT"
  | "GRANT_REQUIRED"
  | "RECEIPT_INVALID"
  | "UNMANAGED_URL"
  | "LEGACY_AMBIGUOUS"
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
  CONTENT_MODEL_UPGRADE_REQUIRED: 409,
  CONTENT_MODEL_NOT_ENABLED: 409,
  CONTENT_MODEL_READONLY: 423,
  ARCHIVED: 409,
  DEPENDENCY_CONFLICT: 409,
  GRANT_REQUIRED: 403,
  RECEIPT_INVALID: 400,
  UNMANAGED_URL: 400,
  LEGACY_AMBIGUOUS: 409,
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
  /** CONTENT_MODEL_*: the organization's state. */
  content_model_state?: ContentModelState;
}

// ───────────────────────── shared enums ─────────────────────────

export type ProjectRole = "manager" | "editor" | "viewer";
export const PROJECT_ROLES: readonly ProjectRole[] = ["manager", "editor", "viewer"];
/** Roles a project manager (not org owner/admin) may hand out. */
export const MANAGER_ASSIGNABLE_ROLES: readonly ProjectRole[] = ["editor", "viewer"];
export const DEFAULT_PROJECT_ROLE: ProjectRole = "editor";

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

export type UploadPurpose = "asset_version" | "anchor_reference" | "legacy_asset";

// ───────────────────────── capabilities ─────────────────────────

export interface OrganizationCapabilities {
  can_read: boolean;
  /** Owner/admin (or super_admin): implicit manager of every project. */
  can_administer: boolean;
  can_manage_content_model: boolean;
}

export interface WorkspaceCapabilities {
  can_read: boolean;
  /** Upload, create/edit scenes, publish, manage placements. */
  can_edit: boolean;
  /** Project member management (editor/viewer). */
  can_manage_members: boolean;
  /** May grant the manager role (org owner/admin only). */
  can_assign_manager: boolean;
  can_archive: boolean;
}

export interface AssetCapabilities {
  can_read: boolean;
  /** Source maintenance: name, visibility, versions, archive, grants. */
  can_maintain: boolean;
  /** Owner/admin only. */
  can_transfer_maintainer: boolean;
  /** Present when the request named a target workspace (`usable_in`). */
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
  /** Copy the fixed content into the request's workspace (own or legacy scope). */
  can_copy: boolean;
  /** True when shown through a legacy scope of another project. */
  read_only_shared: boolean;
}

// ───────────────────────── organization / workspace ─────────────────────────

export interface OrganizationContentModelDto {
  organization_id: string;
  content_model_state: ContentModelState;
  content_model_changed_at: string | null;
  archived_at: string | null;
  /** Legacy asset rows still attached to this organization's workspaces. */
  legacy_asset_count: number;
  capabilities: OrganizationCapabilities;
}

/** PUT /api/organizations/[id]/content-model (super_admin). */
export interface SetContentModelStateRequest {
  state: ContentModelState;
  /** Required for every transition: the state the caller saw. */
  expectedState: ContentModelState;
  note?: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  create_date: string | null;
  archived_at: string | null;
  /** Effective role after the org-role cap; null when only super_admin access. */
  project_role: ProjectRole | null;
  content_model_state: ContentModelState;
  capabilities: WorkspaceCapabilities;
}

export interface WorkspaceMemberDto {
  user_id: string;
  name: string | null;
  email: string | null;
  org_role: "owner" | "admin" | "member" | "viewer";
  /** Explicit assignment role (null for implicit owner/admin access). */
  assignment_role: ProjectRole | null;
  effective_role: ProjectRole;
  implicit: boolean;
  assigned_at: string | null;
}

/** GET /api/workspaces/[id]/members */
export interface WorkspaceMembersDto {
  workspace_id: string;
  members: WorkspaceMemberDto[];
  /** Org members without access to this project (candidates for PUT). */
  candidates: { user_id: string; name: string | null; email: string | null; org_role: string }[];
  capabilities: WorkspaceCapabilities;
}

/** PUT /api/workspaces/[id]/members → { data: WorkspaceMemberDto } */
export interface PutWorkspaceMemberRequest {
  userId: string;
  role: ProjectRole;
}
// DELETE /api/workspaces/[id]/members?user_id=… → { data: { removed: boolean } }

// POST /api/workspaces/[id]/archive → { data: WorkspaceDto }; DELETE … → restore.

// ───────────────────────── uploads ─────────────────────────

export interface UploadReceiptDto {
  id: string;
  organization_id: string;
  workspace_id: string;
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
 * POST /api/upload (multipart: file, type, workspace_id, purpose?).
 * Legacy top-level fields are kept for existing callers; `data` is the receipt
 * (absent only when no workspace was given — legacy callers, no v2 use).
 */
export interface UploadResponse {
  url: string;
  contentHash: string;
  storagePath: string | null;
  data?: UploadReceiptDto;
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

/** Scalar-only intrinsic attributes (dimensions, durations, legacy metadata). */
export type PayloadScalar = string | number | boolean | null;
export type PayloadAttributes = Record<string, PayloadScalar>;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Verbatim legacy row fields frozen into a migrated version (written only by
 * scripts/migrate/content-model; create/version APIs reject this field). The
 * runtime restores legacy metadata/config from it; files always come from the
 * version's resources, never from `file_url` here.
 */
export interface LegacyPayloadSnapshot {
  metadata?: JsonValue;
  config?: JsonValue;
  text_content?: string | null;
  name?: string | null;
  file_url?: string | null;
  is_huge?: boolean | null;
}

interface PayloadBase {
  /** Intrinsic, file-independent attributes; no managed file URLs allowed. */
  attributes?: PayloadAttributes;
  capture?: CaptureMetadata;
  /** Read-only: present on migrated versions only. */
  readonly migration_legacy?: LegacyPayloadSnapshot;
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
  visibility: AssetVisibility;
  state: AssetState;
  origin_workspace_id: string | null;
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
 * GET /api/workspaces/[id]/assets           (X-Content-Model: 2) project assets via grants
 * GET /api/organizations/[id]/assets        (X-Content-Model: 2) org catalog
 *   ?view=shared|maintained|all  (default shared; all = owner/admin)
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
 * POST /api/workspaces/[id]/assets (X-Content-Model: 2)
 * → 201 { data: CreateAssetResult }; replay → 200 with created=false.
 */
export interface CreateAssetRequest {
  name: string;
  fileType: AssetFileType;
  payload: AssetVersionPayload;
  resources: ResourceInput[];
  visibility?: AssetVisibility;
  idempotencyKey: string;
  /** Optional one-step placement in the same workspace. */
  placement?: PlacementFieldsInput;
}

export interface CreateAssetResult {
  asset: AssetDto;
  version: AssetVersionDto;
  placement: PlacementDto | null;
  created: boolean;
}

/** GET /api/assets/[id] (X-Content-Model: 2) */
export interface AssetDetailDto extends AssetDto {
  versions: AssetVersionDto[];
  grants: AssetGrantDto[];
}

/** PATCH /api/assets/[id] (X-Content-Model: 2) → { data: AssetDto } */
export interface UpdateAssetRequest {
  expectedLockVersion: number;
  name?: string;
  visibility?: AssetVisibility;
  /** `active` restores an archived asset; archiving is DELETE. */
  state?: AssetState;
  /** Owner/admin only; null hands maintenance back to admins. */
  maintainedBy?: string | null;
}

/** DELETE /api/assets/[id]?expectedLockVersion=N (X-Content-Model: 2) → archive. */
export interface ArchiveAssetResult {
  asset: AssetDto;
  impact: DependencyImpact;
}

/** POST /api/assets/[id]/duplicate → 201 { data: CreateAssetResult } ("另存素材副本") */
export interface DuplicateAssetRequest {
  targetWorkspaceId: string;
  name?: string;
  /** Defaults to the current version. */
  sourceVersionId?: string;
  idempotencyKey: string;
}

export interface AssetGrantDto {
  asset_id: string;
  workspace_id: string;
  workspace_name: string | null;
  created_by: string | null;
  created_at: string;
  /** Null when the caller cannot read the workspace. */
  dependency_count: number | null;
}

/** POST /api/assets/[id]/workspace-grants → 201 { data: AssetGrantDto } */
export interface CreateGrantRequest {
  workspaceId: string;
}
// DELETE /api/assets/[id]/workspace-grants?workspace_id=… → { data: { revoked: true } } or 409 DEPENDENCY_CONFLICT.

export interface DependencyImpact {
  drafts: number;
  revisions: number;
  placements: number;
  /** Visible subset; names of unreadable projects are never returned. */
  items: DependencyItem[];
  restricted_count: number;
}

export type DependencyItem =
  | { kind: "scene_draft"; scene_id: string; scene_name: string; workspace_id: string; workspace_name: string; resource_alias: string; asset_version_id: string; version_no: number }
  | { kind: "scene_revision"; scene_id: string; scene_name: string; scene_revision_id: string; revision_no: number; workspace_id: string; workspace_name: string; resource_alias: string; asset_version_id: string; version_no: number }
  | { kind: "placement"; placement_id: string; placement_name: string | null; status: PlacementStatus; workspace_id: string; workspace_name: string; asset_version_id: string; version_no: number };

/** GET /api/assets/[id]/usage → { data: AssetUsageDto } */
export interface AssetUsageDto {
  asset_id: string;
  current_version_id: string | null;
  impact: DependencyImpact;
  grants: AssetGrantDto[];
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
  workspace_id: string;
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

/** POST /api/workspaces/[id]/scenes → 201 { data: SceneDetailDto } */
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
  /** @deprecated Rejected with 428 LOCK_VERSION_REQUIRED; use `updatePlacements`. */
  updatePlacementIds?: string[];
}

export interface PublishSceneResult {
  revision: SceneRevisionSummaryDto;
  created: boolean;
  updated_placements: PlacementDto[];
}

/** POST /api/scenes/[id]/copy → 201 { data: SceneDetailDto } */
export interface CopySceneRequest {
  targetWorkspaceId: string;
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
 * Local presentation overrides, validated per type. `config` is the legacy
 * mini-program config object (e.g. scale_multiplier); `display` holds legacy
 * presentation metadata (volume, auto, loop, text style). Scalars only.
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
      scene_workspace_id: string;
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
  /** Id the mini-program sees (legacy public id for migrated content). */
  public_id: string;
  /** Other projects that still discover this placement through legacy scopes. */
  legacy_scope_workspace_ids: string[];
  /** No GPS/anchor discovery; listed by the shops endpoint only. */
  directory_only: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  capabilities: PlacementCapabilities;
}

/**
 * GET /api/workspaces/[id]/placements?status=&include_shared=true → { data: PlacementDto[] }
 * GET /api/organizations/[id]/placements → { data: PlacementDto[] } (readable projects, de-duplicated)
 */

/** POST /api/workspaces/[id]/placements → 201 { data: CreatePlacementResult } */
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
 * GET /api/placements/[id]/content?workspace_id=<viewer project>
 * → { data: PlacementContentDto }
 *
 * Fixed playable content of one placement for preview, authorized exactly
 * like GET /api/placements/[id]: read access to the owning project, or read
 * access to `workspace_id` while it holds an active legacy scope for the
 * placement. Returns only what the placement pins — never version history,
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
  /** The pinned version's payload (migration-only `migration_legacy` removed). */
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

// ───────────────────────── legacy-path v2 adapters ─────────────────────────

/** POST /api/assets/move with X-Content-Model: 2 (alias of /api/placements/move). */
export interface LegacyMoveV2Request extends MovePlacementsRequest {
  action: "placement.move";
}

/** POST /api/assets/copy with X-Content-Model: 2 (alias of placement copy). */
export interface LegacyCopyV2Request {
  action: "placement.copy";
  placementIds: string[];
  targetWorkspaceId?: string;
  offsetMeters?: number;
}

// ───────────────────────── anchors (dedicated legacy-identity service) ─────────────────────────

/**
 * Anchors keep their asset row and embedding identity in every state. Under
 * the v2 contract they are maintained through the old paths with the header:
 *   POST   /api/workspaces/[id]/assets  { file_type: "anchor", ... } → 201 { data: legacy anchor row }
 *   PATCH  /api/assets/[id]             AnchorUpdateV2Request          → { data: legacy anchor row }
 *   DELETE /api/assets/[id]?expectedLockVersion=N                      → { data: { deleted: true } } | 409 while placements use it
 * The reference image must be a fresh upload (leased by its receipt) or already referenced.
 */
export interface AnchorCreateV2Request {
  file_type: "anchor";
  name: string;
  file_url: string;
  content_hash?: string;
  text_content?: string | null;
  metadata: { latitude: number; longitude: number; height?: number } & Record<string, PayloadScalar | undefined>;
}

export interface AnchorUpdateV2Request {
  expectedLockVersion?: number;
  name?: string;
  file_url?: string;
  content_hash?: string;
  text_content?: string | null;
  metadata?: Record<string, PayloadScalar>;
}

// ───────────────────────── helpers ─────────────────────────

/** Headers every v2 administrative request should send. */
export function contentModelHeaders(extra?: Record<string, string>): Record<string, string> {
  return { "Content-Type": "application/json", [CONTENT_MODEL_HEADER]: CONTENT_MODEL_VERSION, ...extra };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && typeof (value as ApiErrorBody).error === "string" && typeof (value as ApiErrorBody).code === "string";
}
