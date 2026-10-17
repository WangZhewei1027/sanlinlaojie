/**
 * DTO → presentation mapping for app/manage/content components. The content
 * layer renders props, never endpoint DTOs; everything that crosses that
 * boundary goes through here.
 */
import type {
  AssetDetailDto,
  AssetDto,
  AssetVersionDto,
  DependencyImpact,
  SceneSummaryDto,
  UserRefDto,
  WorkspaceDto,
} from "@/lib/content-model/contracts";
import type {
  AssetDetailData,
  AssetUsageKind,
  AssetUsageSummary,
  AssetVersion,
  CollectionItem,
  ContentAssetType,
  ContentPerson,
  SceneStatus,
  WorkbenchItem,
} from "@/app/manage/content/types";
import { collectionHref, teamHref } from "./content-context";

const CONTENT_TYPES: readonly ContentAssetType[] = ["image", "video", "audio", "model", "text", "link", "document"];

/** Shop and anchor rows keep their dedicated panels and never enter the generic library. */
export function isLibraryAsset(asset: Pick<AssetDto, "file_type">) {
  return (CONTENT_TYPES as readonly string[]).includes(asset.file_type);
}

export function contentType(fileType: string): ContentAssetType {
  return (CONTENT_TYPES as readonly string[]).includes(fileType) ? (fileType as ContentAssetType) : "document";
}

export function personOf(user: UserRefDto | null | undefined): ContentPerson | null {
  if (!user) return null;
  return { id: user.user_id, name: user.name || user.email || user.user_id.slice(0, 8) };
}

export function primaryResource(version: AssetVersionDto | null | undefined) {
  return version?.resources.find((resource) => resource.role === "primary")
    ?? version?.resources.find((resource) => resource.role === "reference")
    ?? null;
}

export function thumbnailOf(version: AssetVersionDto | null | undefined): string | null {
  if (!version) return null;
  const thumbnail = version.resources.find((resource) => resource.role === "thumbnail");
  if (thumbnail) return thumbnail.url;
  const primary = primaryResource(version);
  return primary && (version.payload.kind === "image" || version.payload.kind === "shop") ? primary.url : null;
}

export function excerptOf(version: AssetVersionDto | null | undefined): string | null {
  const payload = version?.payload;
  if (!payload) return null;
  if (payload.kind === "text") return payload.text.slice(0, 140);
  if (payload.kind === "link") return payload.title || payload.url;
  return null;
}

/** File-backed kinds must carry a primary resource; a missing one is a repair case. */
export function isFileMissing(asset: Pick<AssetDto, "file_type" | "current_version">) {
  if (!asset.current_version) return false;
  if (asset.file_type === "text" || asset.file_type === "link") return false;
  return !primaryResource(asset.current_version);
}

export function toWorkbenchAsset(asset: AssetDto, people?: ReadonlyMap<string, ContentPerson>): WorkbenchItem {
  return {
    id: asset.id,
    kind: "asset",
    name: asset.name || asset.id.slice(0, 8),
    type: contentType(asset.file_type),
    thumbnailUrl: thumbnailOf(asset.current_version),
    textExcerpt: excerptOf(asset.current_version),
    state: asset.state,
    updatedAt: asset.updated_at,
    updatedBy: asset.created_by ? people?.get(asset.created_by) ?? null : null,
    fileMissing: isFileMissing(asset),
  };
}

export function toDetailData(asset: AssetDetailDto): AssetDetailData {
  return {
    id: asset.id,
    name: asset.name || asset.id.slice(0, 8),
    type: contentType(asset.file_type),
    thumbnailUrl: thumbnailOf(asset.current_version),
    textExcerpt: excerptOf(asset.current_version),
    state: asset.state,
    origin: asset.origin,
    maintainer: personOf(asset.maintainer),
    currentVersionNo: asset.current_version_no ?? 0,
    updatedAt: asset.updated_at,
    fileMissing: isFileMissing(asset),
    createdAt: asset.create_at ?? asset.updated_at,
  };
}

export function toVersions(versions: AssetVersionDto[], people: ReadonlyMap<string, ContentPerson>, impact?: DependencyImpact): AssetVersion[] {
  const counts = new Map<string, number>();
  for (const item of impact?.items ?? []) counts.set(item.asset_version_id, (counts.get(item.asset_version_id) ?? 0) + 1);
  return versions.map((version) => ({
    id: version.id,
    versionNo: version.version_no,
    createdAt: version.created_at,
    createdBy: version.created_by ? people.get(version.created_by) ?? { id: version.created_by, name: version.created_by.slice(0, 8) } : null,
    sizeBytes: primaryResource(version)?.size_bytes ?? null,
    usageCount: impact ? counts.get(version.id) ?? 0 : undefined,
  }));
}

export function usageByKind(impact: DependencyImpact | null | undefined): Record<AssetUsageKind, number> {
  return { draft: impact?.drafts ?? 0, published: impact?.revisions ?? 0, placement: impact?.placements ?? 0 };
}

/** Collection name of a dependency; scenes belong to the team and may report none. */
function collectionNameOf(item: { workspace_name?: string | null }) {
  return item.workspace_name || null;
}

/** Dependency rows (optionally narrowed to one version) plus any count-only remainder. */
export function toUsageSummary(impact: DependencyImpact | null | undefined, organizationId: string, versionId?: string | null): AssetUsageSummary {
  if (!impact) return { entries: [], totalCount: 0, restrictedCount: 0 };
  const items = versionId ? impact.items.filter((item) => item.asset_version_id === versionId) : impact.items;
  const entries = items.map((item, index) => {
    if (item.kind === "placement") {
      return {
        id: `placement:${item.placement_id}:${index}`,
        kind: "placement" as const,
        collectionName: collectionNameOf(item),
        targetName: item.placement_name ?? item.placement_id.slice(0, 8),
        versionNo: item.version_no,
        placementStatus: item.status,
        href: item.workspace_id ? collectionHref(item.workspace_id, organizationId, { placementId: item.placement_id }) : undefined,
      };
    }
    return {
      id: `${item.kind}:${item.scene_id}:${item.resource_alias}:${index}`,
      kind: item.kind === "scene_draft" ? ("draft" as const) : ("published" as const),
      targetName: item.kind === "scene_revision" ? `${item.scene_name} #${item.revision_no}` : item.scene_name,
      versionNo: item.version_no,
      href: teamHref(`/manage/scenes/${item.scene_id}`, organizationId),
    };
  });
  const total = impact.drafts + impact.revisions + impact.placements;
  return {
    entries,
    totalCount: versionId ? entries.length : total,
    restrictedCount: versionId ? 0 : impact.restricted_count,
  };
}

export function sceneStatus(scene: Pick<SceneSummaryDto, "publish_status">): SceneStatus {
  return scene.publish_status === "modified" ? "changed" : scene.publish_status;
}

export function toWorkbenchScene(scene: SceneSummaryDto, people: ReadonlyMap<string, ContentPerson>): WorkbenchItem {
  return {
    id: scene.id,
    kind: "scene",
    name: scene.name,
    type: "scene",
    state: scene.state,
    sceneStatus: sceneStatus(scene),
    latestRevisionNo: scene.latest_revision?.revision_no ?? null,
    placementCount: scene.placement_count,
    // SceneSummaryDto has no active/paused split: leave the active count unknown instead of guessing.
    updatedAt: scene.updated_at,
    updatedBy: scene.updated_by ? people.get(scene.updated_by) ?? null : null,
  };
}

export function toCollectionItem(collection: WorkspaceDto): CollectionItem {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    createdAt: collection.create_date,
    archived: !!collection.archived_at,
    canEdit: !!collection.capabilities?.can_edit,
    canArchive: !!collection.capabilities?.can_archive,
  };
}
