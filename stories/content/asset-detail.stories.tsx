import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetDetail } from "../../app/manage/content/AssetDetail";
import { assetDetail, noop, ok, usage, usageByKind } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Detail",
  component: AssetDetail,
  parameters: { layout: "padded", nextjs: { navigation: { pathname: "/manage/assets/asset-lantern" } } },
  args: {
    asset: assetDetail,
    canMaintain: true,
    uploadAccept: ".glb,.gltf",
    onEditContent: ok,
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
export const Archived: Story = { args: { asset: { ...assetDetail, state: "archived" } } };
export const StaleAfterConflict: Story = { args: { stale: true, onReload: noop } };
export const FileMissing: Story = { args: { asset: { ...assetDetail, fileMissing: true } } };
export const SectionsLoading: Story = { args: { usageStatus: "loading" } };
export const SectionsFailed: Story = { args: { usageStatus: "error", onRetryUsage: noop } };
export const Narrow: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
