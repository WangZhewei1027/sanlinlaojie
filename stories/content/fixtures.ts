// Illustrative fixtures for the content component stories. All names, people
// and dates are invented examples; no request, credential or real record here.
// Thumbnails are inline SVG data URLs so stories never load a remote file.

import type {
  AssetDetailData,
  AssetUsageSummary,
  AssetVersion,
  CollectionItem,
  ContentActionResult,
  ContentPerson,
  SceneRef,
  TeamSummary,
  WorkbenchItem,
} from "../../app/manage/content/types";

export const ok = async (): Promise<ContentActionResult> => ({ ok: true });
export const noop = () => {};

export const people: Record<"lin" | "zhou" | "chen" | "wu", ContentPerson> = {
  lin: { id: "person-lin", name: "示例成员 林" },
  zhou: { id: "person-zhou", name: "示例成员 周" },
  chen: { id: "person-chen", name: "示例成员 陈" },
  wu: { id: "person-wu", name: "示例成员 吴" },
};

export const team: TeamSummary = { name: "示例团队", role: "member" };
export const viewerTeam: TeamSummary = { name: "示例团队", role: "viewer" };

/** Flat two-tone placeholder standing in for an uploaded photo. */
function placeholder(from: string, to: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><rect x="0" y="210" width="400" height="90" fill="#000" opacity=".12"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const workbenchItems: WorkbenchItem[] = [
  {
    id: "scene-intro", kind: "scene", name: "夜游序章", type: "scene", state: "active", sceneStatus: "changed", latestRevisionNo: 4,
    placementCount: 2, updatedAt: "2026-10-15T10:00:00Z", updatedBy: people.zhou,
  },
  { id: "asset-bridge", kind: "asset", name: "石桥立面照片", type: "image", thumbnailUrl: placeholder("#8a9a8b", "#3e4a46"), state: "active", updatedAt: "2026-10-14T03:10:00Z" },
  { id: "asset-lantern", kind: "asset", name: "走马灯模型", type: "model", state: "active", updatedAt: "2026-10-12T09:30:00Z" },
  {
    id: "scene-gate", kind: "scene", name: "灯会入口", type: "scene", state: "active", sceneStatus: "published", latestRevisionNo: 2,
    placementCount: 3, updatedAt: "2026-10-10T08:00:00Z",
  },
  {
    id: "asset-story", kind: "asset", name: "老字号招牌介绍", type: "text", state: "active", updatedAt: "2026-10-09T07:00:00Z",
    textExcerpt: "示例文字：这块招牌记录了街区商号的变迁，从布庄到茶馆，再到今天的文创小店。",
  },
  { id: "asset-teahouse", kind: "asset", name: "茶馆门口全景", type: "image", thumbnailUrl: placeholder("#c9a77c", "#6b4f36"), state: "active", updatedAt: "2026-10-08T05:20:00Z" },
  { id: "asset-audio", kind: "asset", name: "评弹导览音频", type: "audio", state: "active", updatedAt: "2026-10-05T12:00:00Z" },
  { id: "scene-draft", kind: "scene", name: "石桥传说（草稿）", type: "scene", state: "active", sceneStatus: "unpublished", latestRevisionNo: null, placementCount: 0, updatedAt: "2026-10-03T01:20:00Z" },
  { id: "asset-video", kind: "asset", name: "老街晨景延时", type: "video", state: "active", updatedAt: "2026-09-28T06:00:00Z" },
  {
    id: "asset-dragon", kind: "asset", name: "舞龙动画模型（带三段动作的长名称示例，用来检查截断与换行）", type: "model", state: "active",
    updatedAt: "2026-09-25T15:45:00Z", fileMissing: true,
  },
  { id: "asset-link", kind: "asset", name: "非遗展馆预约页", type: "link", textExcerpt: "https://example.com/booking", state: "active", updatedAt: "2026-09-20T02:00:00Z" },
  { id: "asset-doc", kind: "asset", name: "讲解词 2026 版", type: "document", state: "active", updatedAt: "2026-09-18T02:00:00Z" },
];

export const archivedItems: WorkbenchItem[] = [
  { id: "scene-old", kind: "scene", name: "旧版开场", type: "scene", state: "archived", sceneStatus: "archived", latestRevisionNo: 3, placementCount: 1, updatedAt: "2026-07-01T06:00:00Z" },
  { id: "asset-old-photo", kind: "asset", name: "旧牌坊照片", type: "image", thumbnailUrl: placeholder("#9aa3ad", "#4c535b"), state: "archived", updatedAt: "2026-06-11T06:00:00Z" },
];

export const sceneRefs: Record<"placed" | "unplaced", SceneRef> = {
  placed: { id: "scene-intro", name: "夜游序章", placementCount: 2, activePlacementCount: 1 },
  unplaced: { id: "scene-draft", name: "石桥传说（草稿）", placementCount: 0, activePlacementCount: 0 },
};

export const collections: CollectionItem[] = [
  { id: "collection-street", name: "老街导览", description: "主街东西两段的常设导览点位。", createdAt: "2026-05-02T02:00:00Z", archived: false, canEdit: true, canArchive: true },
  { id: "collection-festival", name: "元宵灯会", description: "灯会期间限时开放的场景与互动。", createdAt: "2026-01-20T02:00:00Z", archived: false, canEdit: true, canArchive: true },
  { id: "collection-school", name: "研学路线", description: null, createdAt: "2026-03-11T02:00:00Z", archived: false, canEdit: true, canArchive: true },
];

export const archivedCollections: CollectionItem[] = [
  { id: "collection-expo", name: "旧展陈", description: "2025 年秋季临展。", createdAt: "2025-09-01T02:00:00Z", archived: true, canEdit: true, canArchive: true },
];

export const assetDetail: AssetDetailData = {
  id: "asset-lantern", name: "走马灯模型", type: "model", state: "active", origin: "team_upload",
  maintainer: people.lin, currentVersionNo: 3, createdAt: "2026-09-02T02:00:00Z", updatedAt: "2026-10-12T09:30:00Z",
};

export const versions: AssetVersion[] = [
  { id: "v3", versionNo: 3, createdAt: "2026-10-12T09:30:00Z", createdBy: people.lin, note: "示例说明：减少面数，修正灯罩贴图", sizeBytes: 4_820_000, usageCount: 1 },
  { id: "v2", versionNo: 2, createdAt: "2026-09-20T05:12:00Z", createdBy: people.lin, note: "示例说明：增加旋转动画", sizeBytes: 5_310_000, usageCount: 3 },
  { id: "v1", versionNo: 1, createdAt: "2026-09-02T02:00:00Z", createdBy: people.zhou, sizeBytes: 5_020_000, usageCount: 2 },
];

export const usage: AssetUsageSummary = {
  totalCount: 5,
  restrictedCount: 0,
  entries: [
    { id: "u1", kind: "published", targetName: "灯会入口 #2", versionNo: 2, href: "#" },
    { id: "u2", kind: "published", targetName: "夜游序章 #4", versionNo: 3, href: "#" },
    { id: "u3", kind: "placement", collectionName: "老街导览", targetName: "东街口投放", versionNo: 2, placementStatus: "active", href: "#" },
    { id: "u4", kind: "placement", collectionName: "元宵灯会", targetName: "广场预热", versionNo: 1, placementStatus: "paused", href: "#" },
    { id: "u5", kind: "draft", targetName: "夜游序章", versionNo: 3, href: "#" },
  ],
};

export const usageByKind = { published: 2, placement: 2, draft: 1 };
