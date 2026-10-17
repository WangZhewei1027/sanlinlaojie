import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContentContextLine } from "../../app/manage/content/ContentContextLine";
import { organizationName, projects } from "./fixtures";

const meta = {
  title: "Manage/Content/Context Line",
  component: ContentContextLine,
  parameters: { layout: "padded" },
  args: { organizationName, project: projects.street, role: "editor" },
} satisfies Meta<typeof ContentContextLine>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectEditor: Story = {};
export const ProjectViewer: Story = { args: { role: "viewer" } };
export const ArchivedProject: Story = { args: { project: projects.closed, role: "manager" } };
export const NoProject: Story = { args: { project: null, role: null } };
