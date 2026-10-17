import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetDetailHeader } from "../../app/manage/content/AssetDetailHeader";
import { assetDetail, noop } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Detail Header",
  component: AssetDetailHeader,
  parameters: { layout: "padded" },
  args: { asset: assetDetail, canMaintain: true, onUploadVersion: noop },
} satisfies Meta<typeof AssetDetailHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TeamMember: Story = {};
export const Viewer: Story = { args: { canMaintain: false } };
export const MigratedWithoutMaintainer: Story = { args: { asset: { ...assetDetail, maintainer: null, origin: "legacy" } } };
export const ArchivedWithMissingFile: Story = { args: { asset: { ...assetDetail, state: "archived", fileMissing: true } } };
