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

export const Maintainer: Story = {};
export const UseOnly: Story = { args: { canMaintain: false } };
export const UnknownOriginNoMaintainer: Story = { args: { asset: { ...assetDetail, maintainer: null, originProjectName: null, origin: "legacy", visibility: "restricted" } } };
export const ArchivedWithMissingFile: Story = { args: { asset: { ...assetDetail, state: "archived", fileMissing: true } } };
