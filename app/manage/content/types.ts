// Presentation types for the team content components. They describe what the
// UI renders, not API DTOs; the integrating page maps service data into them.

export type ContentAssetType =
  | "image"
  | "video"
  | "audio"
  | "model"
  | "text"
  | "link"
  | "document";

export type ContentLifecycle = "active" | "archived";
export type AssetOrigin = "team_upload" | "public_submission" | "legacy";
export type SceneStatus = "unpublished" | "published" | "changed" | "archived";
export type PlacementStatus = "draft" | "active" | "paused" | "archived";
export type TeamRole = "owner" | "admin" | "member" | "viewer";

export interface ContentPerson {
  id: string;
  name: string;
}

/** The team the workbench and collections belong to. */
export interface TeamSummary {
  name: string;
  /** The viewer's team role, when known; shown only when it limits the page. */
  role?: TeamRole | null;
}

// ───────────────────────── workbench ─────────────────────────

/** Every kind of team content shown in the one workbench. */
export type WorkbenchType = "scene" | ContentAssetType;
export type WorkbenchTypeFilter = "all" | WorkbenchType;
export type WorkbenchView = "grid" | "list";

export interface WorkbenchItem {
  id: string;
  /** Scenes open the editor; assets open their detail page. */
  kind: "asset" | "scene";
  name: string;
  type: WorkbenchType;
  thumbnailUrl?: string | null;
  textExcerpt?: string | null;
  state: ContentLifecycle;
  updatedAt: string;
  updatedBy?: ContentPerson | null;
  /** Scenes only: draft/publication state. */
  sceneStatus?: SceneStatus;
  latestRevisionNo?: number | null;
  /** Scenes only: placements across all collections. */
  placementCount?: number;
  activePlacementCount?: number | null;
  fileMissing?: boolean;
}

export interface WorkbenchFilters {
  query: string;
  type: WorkbenchTypeFilter;
  state: ContentLifecycle;
}

export const DEFAULT_WORKBENCH_FILTERS: WorkbenchFilters = { query: "", type: "all", state: "active" };

// ───────────────────────── asset detail ─────────────────────────

export interface AssetDetailData {
  id: string;
  name: string;
  type: ContentAssetType;
  thumbnailUrl?: string | null;
  textExcerpt?: string | null;
  state: ContentLifecycle;
  origin: AssetOrigin;
  /** Informational only: every editing team member may maintain the asset. */
  maintainer: ContentPerson | null;
  currentVersionNo: number;
  updatedAt: string;
  createdAt: string;
  fileMissing?: boolean;
}

export interface AssetVersion {
  id: string;
  versionNo: number;
  createdAt: string;
  createdBy: ContentPerson | null;
  note?: string | null;
  sizeBytes?: number | null;
  /** Dependencies pinned to this version. */
  usageCount?: number;
}

export type AssetUsageKind = "draft" | "published" | "placement";

export interface AssetUsageEntry {
  id: string;
  kind: AssetUsageKind;
  /** Map collection of a placement; omitted for scenes (they belong to the team). */
  collectionName?: string | null;
  targetName: string;
  versionNo: number;
  href?: string;
  placementStatus?: PlacementStatus;
}

export interface AssetUsageSummary {
  entries: AssetUsageEntry[];
  /** Total dependencies. */
  totalCount: number;
  /** Dependencies the server reports only as a count; usually zero inside one team. */
  restrictedCount: number;
}

// ───────────────────────── scenes ─────────────────────────

/** What the scene dialogs need to name and describe one scene. */
export interface SceneRef {
  id: string;
  name: string;
  placementCount?: number;
  activePlacementCount?: number | null;
}

// ───────────────────────── map collections ─────────────────────────

export interface CollectionItem {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: string | null;
  archived: boolean;
  /** Server capabilities of this collection. */
  canEdit: boolean;
  canArchive: boolean;
}

export interface CollectionInput {
  name: string;
  description: string;
}

export interface PinnedTargetOption {
  id: string;
  number: number;
  createdAt: string;
}

export type ContentLoadStatus = "loading" | "ready" | "error";

/** Outcome of a mutating callback. `void` is treated as success. */
export type ContentActionResult =
  | { ok: true }
  | {
      ok: false;
      kind: "conflict" | "forbidden" | "error";
      message?: string;
      /** Already-localized impact lines, e.g. "东街合集 · 灯会入口". */
      details?: string[];
    };

export type ContentAction<Args extends unknown[] = []> = (
  ...args: Args
) => Promise<ContentActionResult | void>;

/** Draft lock compared with the lock version the latest revision was published from. */
export function deriveSceneStatus(input: {
  archived: boolean;
  draftLockVersion: number;
  latestRevisionSourceLockVersion: number | null;
}): SceneStatus {
  if (input.archived) return "archived";
  if (input.latestRevisionSourceLockVersion === null) return "unpublished";
  return input.latestRevisionSourceLockVersion === input.draftLockVersion ? "published" : "changed";
}
