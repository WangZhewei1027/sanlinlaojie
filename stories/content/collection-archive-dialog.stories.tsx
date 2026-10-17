import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CollectionArchiveDialog } from "../../app/manage/content/CollectionArchiveDialog";
import { collections, noop, ok } from "./fixtures";

const meta = {
  title: "Manage/Content/Collection Archive Dialog",
  component: CollectionArchiveDialog,
  parameters: { layout: "centered" },
  args: { collection: collections[1], onOpenChange: noop, onArchive: ok },
} satisfies Meta<typeof CollectionArchiveDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ArchiveCollection: Story = {};
