import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProjectRoleSelect } from "../../app/manage/content/ProjectRoleSelect";
import { noop } from "./fixtures";

const meta = {
  title: "Manage/Content/Project Role Select",
  component: ProjectRoleSelect,
  parameters: { layout: "padded" },
  args: { value: "editor", onChange: noop, allowedRoles: ["manager", "editor", "viewer"] },
} satisfies Meta<typeof ProjectRoleSelect>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OrganizationAdmin: Story = {};
export const ProjectManagerAssigning: Story = { args: { allowedRoles: ["editor", "viewer"] } };
export const ExistingManagerViewedByProjectManager: Story = { args: { value: "manager", allowedRoles: ["editor", "viewer"], disabled: true } };
export const OrganizationViewerCapped: Story = { args: { value: "viewer", cappedAtViewer: true } };
