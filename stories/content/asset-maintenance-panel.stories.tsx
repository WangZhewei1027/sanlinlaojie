import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetMaintenancePanel } from "../../app/manage/content/AssetMaintenancePanel";
import { ok, people, usageByKind } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Maintenance Panel",
  component: AssetMaintenancePanel,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
  args: {
    assetName: "走马灯模型",
    state: "active",
    maintainer: people.lin,
    canMaintain: true,
    canTransfer: true,
    candidates: Object.values(people),
    impact: usageByKind,
    onTransfer: ok,
    onArchive: ok,
    onRestore: ok,
  },
} satisfies Meta<typeof AssetMaintenancePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OrganizationAdmin: Story = {};
export const Maintainer: Story = { args: { canTransfer: false } };
export const UseOnly: Story = { args: { canMaintain: false, canTransfer: false } };
export const Unassigned: Story = { args: { maintainer: null } };
export const Archived: Story = { args: { state: "archived" } };
