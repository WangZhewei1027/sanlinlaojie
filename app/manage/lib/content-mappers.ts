/**
 * DTO → presentation mapping for app/manage/content components. The content
 * layer renders props, never endpoint DTOs; everything that crosses that
 * boundary goes through here.
 */
import type {
  AssetDetailDto,
  AssetDto,
  AssetGrantDto,
  AssetVersionDto,
  DependencyImpact,
  SceneSummaryDto,
  UserRefDto,
} from "@/lib/content-model/contracts";
import type {
  AssetDetailData,
  AssetLibraryItem,
  AssetProjectGrant,
  AssetUsageKind,
  AssetUsageSummary,
  AssetVersion,
  ContentAssetType,
  ContentPerson,
  SceneListItem,
  SceneStatus,
} from "@/app/manage/content/types";
import { contextHref } from "./content-context";

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

export function toLibraryItem(asset: AssetDto, projectNames: ReadonlyMap<string, string>): AssetLibraryItem {
  return {
    id: asset.id,
    name: asset.name || asset.id.slice(0, 8),
    type: contentType(asset.file_type),
    thumbnailUrl: thumbnailOf(asset.current_version),
    textExcerpt: excerptOf(asset.current_version),
    visibility: asset.visibility,
    state: asset.state,
    origin: asset.origin,
    maintainer: personOf(asset.maintainer),
    currentVersionNo: asset.current_version_no ?? 0,
    usageCount: asset.usage_count,
    originProjectName: asset.origin_workspace_id ? projectNames.get(asset.origin_workspace_id) ?? null : null,
    updatedAt: asset.updated_at,
    fileMissing: isFileMissing(asset),
  };
}

export function toDetailData(asset: AssetDetailDto, projectNames: ReadonlyMap<string, string>): AssetDetailData {
  const item = toLibraryItem(asset, projectNames);
  const originGrant = asset.grants.find((grant) => grant.workspace_id === asset.origin_workspace_id);
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    thumbnailUrl: item.thumbnailUrl,
    textExcerpt: item.textExcerpt,
    visibility: item.visibility,
    state: item.state,
    origin: item.origin,
    maintainer: item.maintainer,
    currentVersionNo: item.currentVersionNo,
    originProjectName: item.originProjectName ?? originGrant?.workspace_name ?? null,
    updatedAt: item.updatedAt,
    fileMissing: item.fileMissing,
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

/** Visible dependency rows (optionally narrowed to one version) plus restricted counts. */
export function toUsageSummary(impact: DependencyImpact | null | undefined, organizationId: string, versionId?: string | null): AssetUsageSummary {
  if (!impact) return { entries: [], totalCount: 0, restrictedCount: 0 };
  const items = versionId ? impact.items.filter((item) => item.asset_version_id === versionId) : impact.items;
  const entries = items.map((item, index) => {
    if (item.kind === "placement") {
      return {
        id: `placement:${item.placement_id}:${index}`,
        kind: "placement" as const,
        projectName: item.workspace_name,
        targetName: item.placement_name ?? item.placement_id.slice(0, 8),
        versionNo: item.version_no,
        placementStatus: item.status,
        href: contextHref("/manage", { organizationId, workspaceId: item.workspace_id }, { placementId: item.placement_id }),
      };
    }
    return {
      id: `${item.kind}:${item.scene_id}:${item.resource_alias}:${index}`,
      kind: item.kind === "scene_draft" ? ("draft" as const) : ("published" as const),
      projectName: item.workspace_name,
      targetName: item.kind === "scene_revision" ? `${item.scene_name} #${item.revision_no}` : item.scene_name,
      versionNo: item.version_no,
      href: contextHref(`/manage/scenes/${item.scene_id}`, { organizationId, workspaceId: item.workspace_id }),
    };
  });
  const total = impact.drafts + impact.revisions + impact.placements;
  return {
    entries,
    totalCount: versionId ? entries.length : total,
    restrictedCount: versionId ? 0 : impact.restricted_count,
  };
}

export function toGrants(grants: AssetGrantDto[], originWorkspaceId: string | null, archived: ReadonlySet<string>): AssetProjectGrant[] {
  return grants.map((grant) => ({
    projectId: grant.workspace_id,
    projectName: grant.workspace_name ?? grant.workspace_id.slice(0, 8),
    isOrigin: grant.workspace_id === originWorkspaceId,
    dependencyCount: grant.dependency_count ?? 0,
    archived: archived.has(grant.workspace_id),
  }));
}

export function sceneStatus(scene: Pick<SceneSummaryDto, "publish_status">): SceneStatus {
  return scene.publish_status === "modified" ? "changed" : scene.publish_status;
}

export function toSceneListItem(scene: SceneSummaryDto, people: ReadonlyMap<string, ContentPerson>): SceneListItem {
  return {
    id: scene.id,
    name: scene.name,
    status: sceneStatus(scene),
    latestRevisionNo: scene.latest_revision?.revision_no ?? null,
    placementCount: scene.placement_count,
    // SceneSummaryDto has no active/paused split: leave the active count unknown instead of guessing.
    updatedAt: scene.updated_at,
    updatedBy: scene.updated_by ? people.get(scene.updated_by) ?? null : null,
  };
}
