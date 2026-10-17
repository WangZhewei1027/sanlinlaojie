/**
 * Typed browser client for the content model v2 APIs.
 *
 * Every request/response type comes from lib/content-model/contracts.ts; this
 * module only knows paths, verbs and the error envelope. It never toasts:
 * callers decide how a conflict, permission or feature-state error is shown.
 *
 * All requests carry `X-Content-Model: 2`. New paths ignore it; legacy paths
 * (`/api/workspaces/[id]/assets`, `/api/assets/[id]`, …) require it so an old
 * cached client can never be reinterpreted as a v2 write.
 */
import {
  CONTENT_MODEL_HEADER,
  CONTENT_MODEL_VERSION,
  isApiErrorBody,
  type ApiErrorDetails,
  type ApiPage,
  type ArchiveAssetResult,
  type AssetDetailDto,
  type AssetDto,
  type AssetGrantDto,
  type AssetListQuery,
  type AssetUsageDto,
  type ContentErrorCode,
  type CopyPlacementRequest,
  type CopySceneRequest,
  type CreateAssetRequest,
  type CreateAssetResult,
  type CreateAssetVersionRequest,
  type CreatePlacementRequest,
  type CreatePlacementResult,
  type CreateSceneRequest,
  type CreateVersionResult,
  type DuplicateAssetRequest,
  type MovePlacementsRequest,
  type OrganizationContentModelDto,
  type PlacementContentDto,
  type PlacementDto,
  type PlacementStatus,
  type PublishSceneRequest,
  type PublishSceneResult,
  type PutWorkspaceMemberRequest,
  type SaveSceneRequest,
  type SceneDetailDto,
  type SceneRevisionSummaryDto,
  type SceneSummaryDto,
  type UpdateAssetRequest,
  type UpdatePlacementRequest,
  type UploadPurpose,
  type UploadReceiptDto,
  type UploadResponse,
  type WorkspaceDto,
  type WorkspaceMemberDto,
  type WorkspaceMembersDto,
} from "@/lib/content-model/contracts";

export class ContentApiError extends Error {
  readonly status: number;
  /** Null when the response was not a contract error body (network, missing route, HTML). */
  readonly code: ContentErrorCode | null;
  readonly details?: ApiErrorDetails;

  constructor(message: string, status: number, code: ContentErrorCode | null, details?: ApiErrorDetails) {
    super(message);
    this.name = "ContentApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isContentApiError(error: unknown): error is ContentApiError {
  return error instanceof ContentApiError;
}

/** Stale or missing lock: the local draft must be kept and the user offered a reload. */
export function isLockConflict(error: unknown) {
  return isContentApiError(error) && (error.code === "LOCK_VERSION_CONFLICT" || error.code === "LOCK_VERSION_REQUIRED");
}

/** The route does not exist yet (backend not deployed) — distinct from a contract 404. */
export function isEndpointMissing(error: unknown) {
  return isContentApiError(error) && error.code === null && (error.status === 404 || error.status === 405);
}

/** The organization has not been cut over (or is frozen) — show feature state, not an error. */
export function isFeatureStateError(error: unknown) {
  return isContentApiError(error) && (error.code === "CONTENT_MODEL_NOT_ENABLED" || error.code === "CONTENT_MODEL_UPGRADE_REQUIRED");
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

function withQuery(path: string, query?: Query) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}${path.includes("?") ? "&" : "?"}${text}` : path;
}

async function parse<T>(response: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Missing routes return HTML; keep body null so the caller sees code=null.
  }
  if (!response.ok) {
    if (isApiErrorBody(body)) throw new ContentApiError(body.error, response.status, body.code, body.details);
    const message = (body as { error?: unknown } | null)?.error;
    throw new ContentApiError(typeof message === "string" ? message : `HTTP ${response.status}`, response.status, null);
  }
  return body as T;
}

export async function contentRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { [CONTENT_MODEL_HEADER]: CONTENT_MODEL_VERSION };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(withQuery(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ContentApiError(error instanceof Error ? error.message : "Network error", 0, null);
  }
  return parse<T>(response);
}

const get = <T>(path: string, query?: Query, signal?: AbortSignal) => contentRequest<T>(path, { query, signal });
const send = <T>(method: RequestOptions["method"], path: string, body?: unknown, query?: Query) => contentRequest<T>(path, { method, body, query });
const id = encodeURIComponent;

type Data<T> = { data: T };
/** List endpoints may or may not page; normalize to one shape. */
export interface ListResult<T> {
  items: T[];
  total: number | null;
}
function list<T>(body: { data: T[]; page?: { total: number } }): ListResult<T> {
  return { items: body.data ?? [], total: body.page?.total ?? null };
}

// ───────────────────────── organization / workspace ─────────────────────────

export const organizationApi = {
  /** Assumed GET twin of `PUT /api/organizations/[id]/content-model` (see contract). */
  contentModel: (organizationId: string, signal?: AbortSignal) =>
    get<Data<OrganizationContentModelDto>>(`/api/organizations/${id(organizationId)}/content-model`, undefined, signal).then((body) => body.data),
  assets: (organizationId: string, query: AssetListQuery, signal?: AbortSignal) =>
    get<ApiPage<AssetDto>>(`/api/organizations/${id(organizationId)}/assets`, query as Query, signal),
  placements: (organizationId: string, signal?: AbortSignal) =>
    get<Data<PlacementDto[]>>(`/api/organizations/${id(organizationId)}/placements`, undefined, signal).then((body) => body.data ?? []),
};

export const workspaceApi = {
  /** WorkspaceDto through the legacy detail path with the v2 header. */
  get: (workspaceId: string, signal?: AbortSignal) =>
    get<Data<WorkspaceDto>>(`/api/workspaces/${id(workspaceId)}`, undefined, signal).then((body) => body.data),
  /**
   * Project facts plus server capabilities. The legacy detail route returns
   * the raw row without capabilities; then the capabilities come from the
   * members route (readable by any project reader, computed by the same
   * server rules). `project_role` stays null when only that fallback exists.
   */
  info: async (workspaceId: string, signal?: AbortSignal): Promise<WorkspaceDto> => {
    const row = await get<Data<Partial<WorkspaceDto> & { id: string; name: string }>>(`/api/workspaces/${id(workspaceId)}`, undefined, signal).then((body) => body.data);
    if (row && "capabilities" in row && row.capabilities) return row as WorkspaceDto;
    const members = await get<Data<WorkspaceMembersDto>>(`/api/workspaces/${id(workspaceId)}/members`, undefined, signal).then((body) => body.data);
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      organization_id: row.organization_id ?? "",
      create_date: row.create_date ?? null,
      archived_at: row.archived_at ?? null,
      project_role: row.project_role ?? null,
      content_model_state: row.content_model_state ?? "v2",
      capabilities: members.capabilities,
    };
  },
  archive: (workspaceId: string) => send<Data<WorkspaceDto>>("POST", `/api/workspaces/${id(workspaceId)}/archive`).then((body) => body.data),
  restore: (workspaceId: string) => send<Data<WorkspaceDto>>("DELETE", `/api/workspaces/${id(workspaceId)}/archive`).then((body) => body.data),
  members: (workspaceId: string, signal?: AbortSignal) =>
    get<Data<WorkspaceMembersDto>>(`/api/workspaces/${id(workspaceId)}/members`, undefined, signal).then((body) => body.data),
  putMember: (workspaceId: string, request: PutWorkspaceMemberRequest) =>
    send<Data<WorkspaceMemberDto>>("PUT", `/api/workspaces/${id(workspaceId)}/members`, request).then((body) => body.data),
  removeMember: (workspaceId: string, userId: string) =>
    send<Data<{ removed: boolean }>>("DELETE", `/api/workspaces/${id(workspaceId)}/members`, undefined, { user_id: userId }).then((body) => body.data),
  assets: (workspaceId: string, query: AssetListQuery, signal?: AbortSignal) =>
    get<ApiPage<AssetDto>>(`/api/workspaces/${id(workspaceId)}/assets`, query as Query, signal),
  createAsset: (workspaceId: string, request: CreateAssetRequest) =>
    send<Data<CreateAssetResult>>("POST", `/api/workspaces/${id(workspaceId)}/assets`, request).then((body) => body.data),
  scenes: (workspaceId: string, query?: { state?: "active" | "archived" | "all" }, signal?: AbortSignal) =>
    get<{ data: SceneSummaryDto[]; page?: { total: number } }>(`/api/workspaces/${id(workspaceId)}/scenes`, query, signal).then(list),
  createScene: (workspaceId: string, request: CreateSceneRequest) =>
    send<Data<SceneDetailDto>>("POST", `/api/workspaces/${id(workspaceId)}/scenes`, request).then((body) => body.data),
  placements: (workspaceId: string, query?: { status?: PlacementStatus; include_shared?: boolean }, signal?: AbortSignal) =>
    get<Data<PlacementDto[]>>(`/api/workspaces/${id(workspaceId)}/placements`, query, signal).then((body) => body.data ?? []),
  createPlacement: (workspaceId: string, request: CreatePlacementRequest) =>
    send<Data<CreatePlacementResult>>("POST", `/api/workspaces/${id(workspaceId)}/placements`, request).then((body) => body.data),
};

// ───────────────────────── assets ─────────────────────────

export const assetApi = {
  get: (assetId: string, signal?: AbortSignal) => get<Data<AssetDetailDto>>(`/api/assets/${id(assetId)}`, undefined, signal).then((body) => body.data),
  update: (assetId: string, request: UpdateAssetRequest) => send<Data<AssetDto>>("PATCH", `/api/assets/${id(assetId)}`, request).then((body) => body.data),
  archive: (assetId: string, expectedLockVersion: number) =>
    send<Data<ArchiveAssetResult>>("DELETE", `/api/assets/${id(assetId)}`, undefined, { expectedLockVersion }).then((body) => body.data),
  createVersion: (assetId: string, request: CreateAssetVersionRequest) =>
    send<Data<CreateVersionResult>>("POST", `/api/assets/${id(assetId)}/versions`, request).then((body) => body.data),
  usage: (assetId: string, signal?: AbortSignal) => get<Data<AssetUsageDto>>(`/api/assets/${id(assetId)}/usage`, undefined, signal).then((body) => body.data),
  grant: (assetId: string, workspaceId: string) =>
    send<Data<AssetGrantDto>>("POST", `/api/assets/${id(assetId)}/workspace-grants`, { workspaceId }).then((body) => body.data),
  revoke: (assetId: string, workspaceId: string) =>
    send<Data<{ revoked: true }>>("DELETE", `/api/assets/${id(assetId)}/workspace-grants`, undefined, { workspace_id: workspaceId }).then((body) => body.data),
  duplicate: (assetId: string, request: DuplicateAssetRequest) =>
    send<Data<CreateAssetResult>>("POST", `/api/assets/${id(assetId)}/duplicate`, request).then((body) => body.data),
};

// ───────────────────────── scenes ─────────────────────────

export const sceneApi = {
  get: (sceneId: string, signal?: AbortSignal) => get<Data<SceneDetailDto>>(`/api/scenes/${id(sceneId)}`, undefined, signal).then((body) => body.data),
  save: (sceneId: string, request: SaveSceneRequest) => send<Data<SceneDetailDto>>("PATCH", `/api/scenes/${id(sceneId)}`, request).then((body) => body.data),
  publish: (sceneId: string, request: PublishSceneRequest) =>
    send<Data<PublishSceneResult>>("POST", `/api/scenes/${id(sceneId)}/publish`, request).then((body) => body.data),
  copy: (sceneId: string, request: CopySceneRequest) => send<Data<SceneDetailDto>>("POST", `/api/scenes/${id(sceneId)}/copy`, request).then((body) => body.data),
  revisions: (sceneId: string, signal?: AbortSignal) =>
    get<Data<SceneRevisionSummaryDto[]>>(`/api/scenes/${id(sceneId)}/revisions`, undefined, signal).then((body) => body.data ?? []),
};

// ───────────────────────── placements ─────────────────────────

export const placementApi = {
  content: (placementId: string, workspaceId?: string | null, signal?: AbortSignal) =>
    get<Data<PlacementContentDto>>(`/api/placements/${id(placementId)}/content`, { workspace_id: workspaceId }, signal).then((body) => body.data),
  update: (placementId: string, request: UpdatePlacementRequest) =>
    send<Data<PlacementDto>>("PATCH", `/api/placements/${id(placementId)}`, request).then((body) => body.data),
  archive: (placementId: string, expectedLockVersion: number) =>
    send<Data<PlacementDto>>("DELETE", `/api/placements/${id(placementId)}`, undefined, { expectedLockVersion }).then((body) => body.data),
  move: (request: MovePlacementsRequest) => send<Data<PlacementDto[]>>("POST", "/api/placements/move", request).then((body) => body.data ?? []),
  copy: (placementId: string, request: CopyPlacementRequest) =>
    send<Data<CreatePlacementResult>>("POST", `/api/placements/${id(placementId)}/copy`, request).then((body) => body.data),
};

// ───────────────────────── uploads ─────────────────────────

/**
 * Upload one already-processed file and return its receipt. The receipt (not
 * the URL) is what version and placement commands accept.
 */
export async function uploadReceipt(
  file: File,
  options: { type: string; workspaceId: string; purpose?: UploadPurpose; signal?: AbortSignal },
): Promise<UploadReceiptDto> {
  const form = new FormData();
  form.set("file", file, file.name);
  form.set("type", options.type);
  form.set("workspace_id", options.workspaceId);
  form.set("purpose", options.purpose ?? "asset_version");
  let response: Response;
  try {
    response = await fetch("/api/upload", {
      method: "POST",
      body: form,
      headers: { [CONTENT_MODEL_HEADER]: CONTENT_MODEL_VERSION },
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ContentApiError(error instanceof Error ? error.message : "Network error", 0, null);
  }
  const body = await parse<UploadResponse>(response);
  if (!body.data) throw new ContentApiError("Upload receipt missing", 502, "RECEIPT_INVALID");
  return body.data;
}

/** One key per user intent; reuse it for retries of the same intent. */
export function newIdempotencyKey() {
  return crypto.randomUUID();
}
