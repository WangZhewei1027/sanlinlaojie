import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetMaintenancePanel } from "../../app/manage/content/AssetMaintenancePanel";
import { ok, usageByKind } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Maintenance Panel",
  component: AssetMaintenancePanel,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
  args: {
    assetName: "走马灯模型",
    state: "active",
    canMaintain: true,
    impact: usageByKind,
    onArchive: ok,
    onRestore: ok,
  },
} satisfies Meta<typeof AssetMaintenancePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TeamMember: Story = {};
export const Viewer: Story = { args: { canMaintain: false } };
export const Archived: Story = { args: { state: "archived" } };
export const RestoreFailed: Story = {
  args: { state: "archived", onRestore: async () => ({ ok: false, kind: "conflict", message: "示例：素材已被他人修改，请重新载入。" }) },
};
