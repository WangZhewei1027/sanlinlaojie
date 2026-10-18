import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CollectionCard } from "../../app/manage/content/CollectionCard";
import { archivedCollections, collections, noop } from "./fixtures";

const meta = {
  title: "Manage/Content/Collection Card", component: CollectionCard,
  parameters: { layout: "centered" },
  decorators: [(Story) => <ul className="w-48"><Story /></ul>],
  args: { collection: collections[0], href: "#", onEdit: noop, onArchive: noop },
} satisfies Meta<typeof CollectionCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MapCollection: Story = {};
export const Viewer: Story = { args: { onEdit: undefined, onArchive: undefined } };
export const LongName: Story = { args: { collection: { ...collections[0], name: "老街历史文化导览与沿河街巷常设展陈地图合集", description: "包含主街东西两段、沿河街巷及常设展陈的导览点位。" } } };
export const NoDescription: Story = { args: { collection: collections[2] } };
export const NoDate: Story = { args: { collection: { ...collections[0], createdAt: null } } };
export const Archived: Story = { args: { collection: archivedCollections[0], onEdit: undefined, onArchive: undefined, onRestore: noop } };
export const Restoring: Story = { args: { ...Archived.args, busy: true } };
