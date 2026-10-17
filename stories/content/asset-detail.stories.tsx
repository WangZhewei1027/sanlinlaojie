import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetDetail } from "../../app/manage/content/AssetDetail";
import { assetDetail, grants, noop, ok, people, projects, usage, usageByKind, versions } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Detail",
  component: AssetDetail,
  parameters: { layout: "padded", nextjs: { navigation: { pathname: "/manage/assets/asset-lantern" } } },
  args: {
    asset: assetDetail,
    canMaintain: true,
    canTransfer: true,
    versions,
    currentVersionId: "v3",
    selectedVersionId: null,
    onSelectVersion: noop,
    uploadAccept: ".glb,.gltf",
    onUploadVersion: ok,
    usage,
    usageByKind,
    grants,
    grantableProjects: [projects.closed],
    onVisibilityChange: ok,
    onGrant: ok,
    onRevoke: ok,
    maintainerCandidates: Object.values(people),
    onTransfer: ok,
    onArchive: ok,
    onRestore: ok,
  },
} satisfies Meta<typeof AssetDetail>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Maintainer: Story = {};
export const UseOnlyMember: Story = { args: { canMaintain: false, canTransfer: false } };
export const VersionSelected: Story = {
  args: { selectedVersionId: "v2", usage: { totalCount: 3, restrictedCount: 1, entries: usage.entries.filter((entry) => entry.versionNo === 2) } },
};
export const Archived: Story = { args: { asset: { ...assetDetail, state: "archived" } } };
export const StaleAfterConflict: Story = { args: { stale: true, onReload: noop } };
export const FileMissing: Story = { args: { asset: { ...assetDetail, fileMissing: true } } };
export const SectionsLoading: Story = { args: { versionsStatus: "loading", usageStatus: "loading" } };
export const SectionsFailed: Story = { args: { versionsStatus: "error", usageStatus: "error", onRetryVersions: noop, onRetryUsage: noop } };
export const Narrow: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
