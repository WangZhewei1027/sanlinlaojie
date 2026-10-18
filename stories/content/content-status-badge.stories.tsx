import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContentStatusBadge } from "../../app/manage/content/ContentStatusBadge";

const meta = {
  title: "Manage/Content/Status Badge",
  component: ContentStatusBadge,
  parameters: { layout: "centered" },
  args: { kind: "archived" },
  argTypes: {
    kind: { control: "select", options: ["archived", "fileMissing"] },
  },
} satisfies Meta<typeof ContentStatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Archived: Story = { args: { kind: "archived" } };
export const FileMissing: Story = { args: { kind: "fileMissing" } };
