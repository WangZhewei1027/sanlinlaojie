import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetVersionUpgrade } from "../../app/manage/content/AssetVersionUpgrade";
import { noop, ok } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Version Upgrade",
  component: AssetVersionUpgrade,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-xs"><Story /></div>],
  args: { assetName: "走马灯模型", referenceId: "lantern_1", pinnedVersionNo: 1, latestVersionNo: 3, assetState: "active", aliasInstanceCount: 1, onPreview: noop, onUpgrade: ok },
} satisfies Meta<typeof AssetVersionUpgrade>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleObject: Story = {};
export const SharedAlias: Story = { args: { aliasInstanceCount: 3 } };
export const Previewing: Story = { args: { previewing: true } };
export const MissingAnimationClip: Story = { args: { missingClipName: "Spin" } };
export const ArchivedAsset: Story = { args: { assetState: "archived" } };
export const UpToDate: Story = { args: { pinnedVersionNo: 3 } };
