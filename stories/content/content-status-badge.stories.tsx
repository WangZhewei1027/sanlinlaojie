import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContentStatusBadge } from "../../app/manage/content/ContentStatusBadge";

const meta = {
  title: "Manage/Content/Status Badge",
  component: ContentStatusBadge,
  parameters: { layout: "centered" },
  args: { kind: "organization" },
  argTypes: {
    kind: { control: "select", options: ["organization", "restricted", "inProject", "archived", "fileMissing", "unpublished", "published", "changed", "outdated"] },
  },
} satisfies Meta<typeof ContentStatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const SharedWithOrganization: Story = { args: { kind: "organization" } };
export const Restricted: Story = { args: { kind: "restricted" } };
export const InCurrentProject: Story = { args: { kind: "inProject" } };
export const Archived: Story = { args: { kind: "archived" } };
export const FileMissing: Story = { args: { kind: "fileMissing" } };
export const Unpublished: Story = { args: { kind: "unpublished" } };
export const Published: Story = { args: { kind: "published", number: 4 } };
export const UnpublishedChanges: Story = { args: { kind: "changed" } };
export const NewerVersionAvailable: Story = { args: { kind: "outdated", number: 3 } };
