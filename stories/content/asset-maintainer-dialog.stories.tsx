import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetMaintainerDialog } from "../../app/manage/content/AssetMaintainerDialog";
import { noop, ok, people } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Maintainer Dialog",
  component: AssetMaintainerDialog,
  parameters: { layout: "centered" },
  args: { open: true, onOpenChange: noop, assetName: "走马灯模型", currentMaintainer: people.lin, candidates: Object.values(people), onTransfer: ok },
} satisfies Meta<typeof AssetMaintainerDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Transfer: Story = {};
export const AssignWhenUnassigned: Story = { args: { currentMaintainer: null } };
export const NoCandidates: Story = { args: { candidates: [people.lin] } };
