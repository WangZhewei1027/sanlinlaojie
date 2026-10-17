// Illustrative fixtures for the content component stories. All names, people
// and dates are invented examples; no request, credential or real record here.

import type {
  AssetDetailData,
  AssetLibraryItem,
  AssetProjectGrant,
  AssetUsageSummary,
  AssetVersion,
  ContentActionResult,
  ContentPerson,
  ContentProject,
  SceneListItem,
} from "../../app/manage/content/types";

export const ok = async (): Promise<ContentActionResult> => ({ ok: true });
export const noop = () => {};

export const people: Record<"lin" | "zhou" | "chen" | "wu", ContentPerson> = {
  lin: { id: "person-lin", name: "示例成员 林" },
  zhou: { id: "person-zhou", name: "示例成员 周" },
  chen: { id: "person-chen", name: "示例成员 陈" },
  wu: { id: "person-wu", name: "示例成员 吴" },
};

export const projects: Record<"street" | "festival" | "school" | "closed", ContentProject> = {
  street: { id: "project-street", name: "示例项目 老街导览" },
  festival: { id: "project-festival", name: "示例项目 元宵灯会" },
  school: { id: "project-school", name: "示例项目 研学路线" },
  closed: { id: "project-closed", name: "示例项目 旧展陈", archived: true },
};

export const organizationName = "示例组织";

export const libraryItems: AssetLibraryItem[] = [
  {
    id: "asset-lantern", name: "走马灯模型", type: "model", visibility: "organization", state: "active", origin: "team_upload",
    maintainer: people.lin, currentVersionNo: 3, usageCount: 6, originProjectName: projects.festival.name, updatedAt: "2026-10-12T09:30:00Z",
  },
  {
    id: "asset-bridge", name: "石桥立面照片", type: "image", visibility: "restricted", state: "active", origin: "team_upload",
    maintainer: people.zhou, currentVersionNo: 1, usageCount: 2, originProjectName: projects.street.name, updatedAt: "2026-10-08T03:10:00Z",
  },
  {
    id: "asset-story", name: "老字号招牌介绍", type: "text", visibility: "organization", state: "active", origin: "legacy",
    textExcerpt: "示例文字：这块招牌记录了街区商号的变迁。", maintainer: null, currentVersionNo: 2, usageCount: 0,
    originProjectName: null, updatedAt: "2026-09-21T07:00:00Z",
  },
  {
    id: "asset-audio", name: "评弹导览音频", type: "audio", visibility: "organization", state: "archived", origin: "team_upload",
    maintainer: people.chen, currentVersionNo: 4, usageCount: 3, originProjectName: projects.school.name, updatedAt: "2026-08-30T12:00:00Z",
  },
  {
    id: "asset-dragon", name: "舞龙动画模型（带三段动作的长名称示例，用来检查截断与换行）", type: "model", visibility: "restricted",
    state: "active", origin: "team_upload", maintainer: people.wu, currentVersionNo: 7, usageCount: 12, originProjectName: projects.festival.name,
    updatedAt: "2026-10-14T15:45:00Z", fileMissing: true,
  },
];

export const organizationItems: AssetLibraryItem[] = libraryItems.map((item, index) => ({ ...item, inProject: index % 2 === 0 }));

export const assetDetail: AssetDetailData = {
  id: "asset-lantern", name: "走马灯模型", type: "model", visibility: "organization", state: "active", origin: "team_upload",
  maintainer: people.lin, currentVersionNo: 3, originProjectName: projects.festival.name,
  createdAt: "2026-09-02T02:00:00Z", updatedAt: "2026-10-12T09:30:00Z",
};

export const versions: AssetVersion[] = [
  { id: "v3", versionNo: 3, createdAt: "2026-10-12T09:30:00Z", createdBy: people.lin, note: "示例说明：减少面数，修正灯罩贴图", sizeBytes: 4_820_000, usageCount: 1 },
  { id: "v2", versionNo: 2, createdAt: "2026-09-20T05:12:00Z", createdBy: people.lin, note: "示例说明：增加旋转动画", sizeBytes: 5_310_000, usageCount: 3 },
  { id: "v1", versionNo: 1, createdAt: "2026-09-02T02:00:00Z", createdBy: people.zhou, sizeBytes: 5_020_000, usageCount: 2 },
];

export const usage: AssetUsageSummary = {
  totalCount: 6,
  restrictedCount: 1,
  entries: [
    { id: "u1", kind: "published", projectName: projects.festival.name, targetName: "灯会入口", versionNo: 2, href: "#" },
    { id: "u2", kind: "published", projectName: projects.street.name, targetName: "夜游序章", versionNo: 3, href: "#" },
    { id: "u3", kind: "placement", projectName: projects.street.name, targetName: "东街口投放", versionNo: 2, placementStatus: "active" },
    { id: "u4", kind: "placement", projectName: projects.festival.name, targetName: "广场预热", versionNo: 1, placementStatus: "paused" },
    { id: "u5", kind: "draft", projectName: projects.street.name, targetName: "夜游序章", versionNo: 3, href: "#" },
  ],
};

export const usageByKind = { published: 2, placement: 2, draft: 2 };

export const grants: AssetProjectGrant[] = [
  { projectId: projects.festival.id, projectName: projects.festival.name, isOrigin: true, dependencyCount: 2 },
  { projectId: projects.street.id, projectName: projects.street.name, isOrigin: false, dependencyCount: 3 },
  { projectId: projects.school.id, projectName: projects.school.name, isOrigin: false, dependencyCount: 0 },
];

export const scenes: SceneListItem[] = [
  { id: "scene-intro", name: "夜游序章", status: "changed", latestRevisionNo: 4, placementCount: 2, activePlacementCount: 1, updatedAt: "2026-10-14T10:00:00Z", updatedBy: people.zhou },
  { id: "scene-gate", name: "灯会入口", status: "published", latestRevisionNo: 2, placementCount: 1, activePlacementCount: 1, updatedAt: "2026-10-10T08:00:00Z", updatedBy: people.lin },
  { id: "scene-draft", name: "石桥传说（草稿）", status: "unpublished", latestRevisionNo: null, placementCount: 0, activePlacementCount: 0, updatedAt: "2026-10-15T01:20:00Z", updatedBy: people.chen },
  { id: "scene-old", name: "旧版开场", status: "archived", latestRevisionNo: 3, placementCount: 1, activePlacementCount: 0, updatedAt: "2026-07-01T06:00:00Z", updatedBy: null },
];
