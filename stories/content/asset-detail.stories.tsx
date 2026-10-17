import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetDetail } from "../../app/manage/content/AssetDetail";
import { assetDetail, noop, ok, usage, usageByKind, versions } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Detail",
  component: AssetDetail,
  parameters: { layout: "padded", nextjs: { navigation: { pathname: "/manage/assets/asset-lantern" } } },
  args: {
    asset: assetDetail,
    canMaintain: true,
    versions,
    currentVersionId: "v3",
    selectedVersionId: null,
    onSelectVersion: noop,
    uploadAccept: ".glb,.gltf",
    onUploadVersion: ok,
    usage,
    usageByKind,
    onArchive: ok,
    onRestore: ok,
  },
} satisfies Meta<typeof AssetDetail>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TeamMember: Story = {};
export const Viewer: Story = { args: { canMaintain: false } };
export const VersionSelected: Story = {
  args: { selectedVersionId: "v2", usage: { totalCount: 2, restrictedCount: 0, entries: usage.entries.filter((entry) => entry.versionNo === 2) } },
};
export const Archived: Story = { args: { asset: { ...assetDetail, state: "archived" } } };
export const StaleAfterConflict: Story = { args: { stale: true, onReload: noop } };
export const FileMissing: Story = { args: { asset: { ...assetDetail, fileMissing: true } } };
export const SectionsLoading: Story = { args: { versionsStatus: "loading", usageStatus: "loading" } };
export const SectionsFailed: Story = { args: { versionsStatus: "error", usageStatus: "error", onRetryVersions: noop, onRetryUsage: noop } };
export const Narrow: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
