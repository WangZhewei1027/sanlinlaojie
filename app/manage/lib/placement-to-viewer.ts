/**
 * Single translation point between placements and the map iframe
 * (public/js/viewer).
 *
 * The viewer still speaks the message names (SET_ASSETS, ASSET_CLICKED,
 * ASSETS_MOVED …) and reads `id, file_type, file_url, text_content, name,
 * anchor_id, metadata.{longitude,latitude,height}`. Content ids identify a
 * Placement; activity point markers combine their association and fixed point
 * ids. Source identities travel alongside for the React side only.
 */
import type { ActivityDto, ActivityPlacementDto } from "@/lib/activities/contracts";
import type { PlacementAssetContentDto, PlacementContentDto, PlacementDto } from "@/lib/content-model/contracts";
import { ALL_WORKSPACES_ID } from "../constants";

export interface ViewerPlacementItem {
  /** Content placement ID or activity marker identity (the only ID the viewer knows). */
  id: string;
  file_type: string;
  file_url: string | null;
  text_content: string | null;
  name: string | null;
  /** Placement id of the anchor's own placement in the same list, else null. */
  anchor_id: string | null;
  metadata: { longitude: number; latitude: number; height: number; duration?: number };
  sourceAssetId: string | null;
  /** Activity placement owning this map marker; absent for content placements. */
  activityPlacementId?: string;
  sceneId: string | null;
  workspace_id: string;
}

export type PlacementContentIndex = Readonly<Record<string, PlacementContentDto>>;

export function placementScopeKey(organizationId: string, workspaceId: string | null): string {
  return `${organizationId}|${workspaceId ?? ALL_WORKSPACES_ID}`;
}

/** A fixed target read in one project never supplies content in another. */
export function placementContentKey(scopeKey: string, placement: PlacementDto): string {
  const target = placement.target;
  return `${scopeKey}|${placement.id}|${target.kind}|${target.kind === "asset" ? `${target.asset_id}:${target.asset_lock_version}` : target.scene_id}`;
}

export function contentMatchesPlacement(content: PlacementContentDto, placement: PlacementDto): boolean {
  const target = placement.target;
  if (content.placement_id !== placement.id) return false;
  return content.kind === "asset" && target.kind === "asset"
    ? content.asset_id === target.asset_id && content.asset_lock_version === target.asset_lock_version
    : content.kind === "scene" && target.kind === "scene"
      && content.scene_id === target.scene_id && content.scene_id === target.scene_id;
}

export function placementContentOf(placement: PlacementDto, contents: PlacementContentIndex, scopeKey: string | null): PlacementContentDto | null {
  const content = scopeKey ? contents[placementContentKey(scopeKey, placement)] : null;
  return content && contentMatchesPlacement(content, placement) ? content : null;
}

/** "scene" for scene revisions, otherwise the source asset's file type. */
export function placementFileType(placement: PlacementDto): string {
  return placement.target.kind === "scene" ? "scene" : placement.target.file_type;
}

export function placementSourceName(placement: PlacementDto): string | null {
  return placement.target.kind === "scene" ? placement.target.scene_name : placement.target.asset_name;
}

export function placementDisplayName(placement: PlacementDto): string {
  return placement.name || placementSourceName(placement) || placement.id.slice(0, 8);
}

/** Playable current content, without catalog capabilities. */
export function assetContentOf(placement: PlacementDto, contents: PlacementContentIndex, scopeKey: string | null): PlacementAssetContentDto | null {
  const content = placementContentOf(placement, contents, scopeKey);
  return content?.kind === "asset" ? content : null;
}

/** Current asset URL and text. */
export function resolvedContentOf(placement: PlacementDto, contents: PlacementContentIndex, scopeKey: string | null): { url: string | null; text: string | null; duration?: number } {
  const content = assetContentOf(placement, contents, scopeKey);
  if (!content) return { url: null, text: null };
  const payload = content.payload;
  const duration = payload.attributes?.duration;
  const base = typeof duration === "number" ? { duration } : {};
  if (payload.kind === "link") return { ...base, url: payload.url, text: payload.title ?? null };
  const text = payload.kind === "text" ? payload.text : payload.kind === "anchor" ? payload.text ?? null : null;
  return { ...base, url: content.resources.find((resource) => (resource.role === "primary" || resource.role === "reference") && resource.ordinal === 0)?.url ?? null, text };
}

/** Only explicitly located content placements reach the map. */
export function isMappable(placement: PlacementDto): placement is PlacementDto & { location: NonNullable<PlacementDto["location"]> } {
  return !!placement.location;
}

export function toViewerItems(placements: readonly PlacementDto[], contents: PlacementContentIndex, scopeKey: string | null): ViewerPlacementItem[] {
  // anchor asset id → the placement that puts that anchor on the map
  const anchorPlacementByAsset = new Map<string, string>();
  for (const placement of placements) {
    if (placement.target.kind === "asset" && placement.target.file_type === "anchor" && isMappable(placement)) {
      if (!anchorPlacementByAsset.has(placement.target.asset_id)) anchorPlacementByAsset.set(placement.target.asset_id, placement.id);
    }
  }
  const items: ViewerPlacementItem[] = [];
  for (const placement of placements) {
    if (!isMappable(placement)) continue;
    const content = resolvedContentOf(placement, contents, scopeKey);
    const target = placement.target;
    items.push({
      id: placement.id,
      file_type: placementFileType(placement),
      file_url: content.url,
      text_content: content.text,
      name: placementDisplayName(placement),
      anchor_id: placement.anchor_id ? anchorPlacementByAsset.get(placement.anchor_id) ?? null : null,
      metadata: {
        longitude: placement.location.longitude,
        latitude: placement.location.latitude,
        height: placement.location.altitude ?? 0,
        ...(content.duration !== undefined ? { duration: content.duration } : {}),
      },
      sourceAssetId: target.kind === "asset" ? target.asset_id : null,
      sceneId: target.kind === "scene" ? target.scene_id : null,
      workspace_id: placement.workspace_id,
    });
  }
  return items;
}

/** FOCUS_ASSET payload for one placement (null when it has no map position). */
export function focusPayload(placement: PlacementDto) {
  if (!isMappable(placement)) return null;
  return {
    id: placement.id,
    longitude: placement.location.longitude,
    latitude: placement.location.latitude,
    height: placement.location.altitude ?? 0,
  };
}

/** Map marker identity includes the association, but coordinates always come from the activity. */
export function toActivityViewerItems(placements: readonly ActivityPlacementDto[], activities: readonly ActivityDto[]): ViewerPlacementItem[] {
  const definitions = new Map(activities.map((activity) => [activity.id, activity]));
  return placements.filter((placement) => placement.status !== "archived").flatMap((placement) => {
    const activity = definitions.get(placement.activity_id);
    if (!activity || activity.state !== "active") return [];
    const points = activity.type === "shop_checkin"
      ? activity.points.filter((point) => point.state === "active").map((point) => ({ id: `${placement.id}:${point.id}`, name: `${activity.name} · ${point.name}`, location: point.location }))
      : [{ id: placement.id, name: activity.name, location: activity.location }];
    return points.flatMap((point) => point.location ? [{
      id: point.id, file_type: "text", file_url: null, text_content: point.name, name: point.name,
      anchor_id: null, metadata: { ...point.location, height: 0 }, sourceAssetId: null, sceneId: null,
      workspace_id: placement.workspace_id, activityPlacementId: placement.id,
    }] : []);
  });
}
