import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CollectionFormDialog } from "../../app/manage/content/CollectionFormDialog";
import { collections, noop, ok } from "./fixtures";

const meta = {
  title: "Manage/Content/Collection Form Dialog",
  component: CollectionFormDialog,
  parameters: { layout: "centered" },
  args: { open: true, onOpenChange: noop, onSubmit: ok },
} satisfies Meta<typeof CollectionFormDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CreateCollection: Story = {};
export const EditCollection: Story = { args: { collection: collections[0] } };
export const SaveFails: Story = {
  args: { collection: collections[0], onSubmit: async () => ({ ok: false, kind: "conflict", message: "示例：合集已被他人修改，请刷新后再试。" }) },
  parameters: { docs: { description: { story: "Submit to see the failure notice; the dialog stays open with the inputs kept." } } },
};
