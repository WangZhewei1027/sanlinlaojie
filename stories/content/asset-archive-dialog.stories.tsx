import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetArchiveDialog } from "../../app/manage/content/AssetArchiveDialog";
import { noop, ok, usageByKind } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Archive Dialog",
  component: AssetArchiveDialog,
  parameters: { layout: "centered" },
  args: { open: true, onOpenChange: noop, assetName: "走马灯模型", impact: usageByKind, onArchive: ok },
} satisfies Meta<typeof AssetArchiveDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithDependencies: Story = {};
export const Unused: Story = { args: { impact: { published: 0, placement: 0, draft: 0 } } };
