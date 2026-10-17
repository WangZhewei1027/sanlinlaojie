import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetVersionHistory } from "../../app/manage/content/AssetVersionHistory";
import { noop, versions } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Version History",
  component: AssetVersionHistory,
  parameters: { layout: "padded" },
  args: { versions, currentVersionId: "v3", selectedVersionId: null, onSelectVersion: noop },
} satisfies Meta<typeof AssetVersionHistory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllVersions: Story = {};
export const VersionSelected: Story = { args: { selectedVersionId: "v1" } };
export const SingleVersion: Story = { args: { versions: [versions[2]], currentVersionId: "v1" } };
export const Loading: Story = { args: { status: "loading" } };
export const LoadError: Story = { args: { status: "error", onRetry: noop } };
