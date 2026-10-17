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

export type AssetVisibility = "restricted" | "organization";
export type ContentLifecycle = "active" | "archived";
export type AssetOrigin = "team_upload" | "public_submission" | "legacy";
export type AssetLibraryScope = "project" | "organization";
export type ProjectRole = "manager" | "editor" | "viewer";
export type SceneStatus = "unpublished" | "published" | "changed" | "archived";
export type PlacementStatus = "draft" | "active" | "paused" | "archived";

export interface ContentPerson {
  id: string;
  name: string;
}

export interface ContentProject {
  id: string;
  name: string;
  archived?: boolean;
}

export interface AssetLibraryItem {
  id: string;
  name: string;
  type: ContentAssetType;
  thumbnailUrl?: string | null;
  textExcerpt?: string | null;
  visibility: AssetVisibility;
  state: ContentLifecycle;
  origin: AssetOrigin;
  maintainer: ContentPerson | null;
  currentVersionNo: number;
  /** All dependencies, including ones the viewer may not see by name. */
  usageCount: number;
  originProjectName?: string | null;
  updatedAt: string;
  /** Organization scope: the current project already holds a use grant. */
  inProject?: boolean;
  fileMissing?: boolean;
}

export interface AssetLibraryFilters {
  query: string;
  type: ContentAssetType | "all";
  state: ContentLifecycle | "all";
  origin: AssetOrigin | "all";
}

export const DEFAULT_ASSET_FILTERS: AssetLibraryFilters = {
  query: "",
  type: "all",
  state: "active",
  origin: "all",
};

export interface AssetDetailData extends Omit<AssetLibraryItem, "inProject" | "usageCount"> {
  createdAt: string;
}

export interface AssetVersion {
  id: string;
  versionNo: number;
  createdAt: string;
  createdBy: ContentPerson | null;
  note?: string | null;
  sizeBytes?: number | null;
  /** Visible plus restricted dependencies pinned to this version. */
  usageCount?: number;
}

export type AssetUsageKind = "draft" | "published" | "placement";

export interface AssetUsageEntry {
  id: string;
  kind: AssetUsageKind;
  projectName: string;
  targetName: string;
  versionNo: number;
  href?: string;
  placementStatus?: PlacementStatus;
}

export interface AssetUsageSummary {
  entries: AssetUsageEntry[];
  /** Total dependencies, visible and restricted. */
  totalCount: number;
  /** Dependencies in projects the viewer cannot read; shown only as a count. */
  restrictedCount: number;
}

export interface AssetProjectGrant {
  projectId: string;
  projectName: string;
  isOrigin: boolean;
  dependencyCount: number;
  archived?: boolean;
}

export interface SceneListItem {
  id: string;
  name: string;
  status: SceneStatus;
  latestRevisionNo: number | null;
  placementCount: number;
  /** Active placements, when the service reports them; omitted rather than guessed. */
  activePlacementCount?: number | null;
  updatedAt: string;
  updatedBy: ContentPerson | null;
}

export interface SceneListFilters {
  query: string;
  /** "current" shows every non-archived scene. */
  status: SceneStatus | "current";
}

export const DEFAULT_SCENE_FILTERS: SceneListFilters = { query: "", status: "current" };

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
      /** Already-localized impact lines, e.g. "项目乙 · 春节灯会". */
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
