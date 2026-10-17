import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetSharingPanel } from "../../app/manage/content/AssetSharingPanel";
import { grants, ok, projects } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Sharing Panel",
  component: AssetSharingPanel,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
  args: {
    visibility: "organization",
    grants,
    grantableProjects: [{ id: "project-new", name: "示例项目 新展区" }, projects.closed],
    canMaintain: true,
    archived: false,
    onVisibilityChange: ok,
    onGrant: ok,
    onRevoke: ok,
  },
} satisfies Meta<typeof AssetSharingPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Maintainer: Story = {};
export const Restricted: Story = { args: { visibility: "restricted" } };
export const ReadOnly: Story = { args: { canMaintain: false } };
export const AllProjectsGranted: Story = { args: { grantableProjects: [] } };
export const NoGrants: Story = { args: { grants: [], visibility: "restricted" } };
export const ArchivedAsset: Story = { args: { archived: true } };
export const RevokeRefused: Story = {
  parameters: { docs: { description: { story: "Remove the grant for the project without references to see a server conflict with impact lines." } } },
  args: {
    onRevoke: async () => ({ ok: false, kind: "conflict", details: ["示例项目 研学路线 · 草稿“校园路线”引用 v2", "示例项目 研学路线 · 投放“操场入口”"] }),
  },
};
