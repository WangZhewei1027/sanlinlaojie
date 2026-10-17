import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneListRow } from "../../app/manage/content/SceneListRow";
import { noop, scenes } from "./fixtures";

const meta = {
  title: "Manage/Content/Scene List Row",
  component: SceneListRow,
  parameters: { layout: "padded" },
  decorators: [(Story) => <ul className="rounded-lg border"><Story /></ul>],
  args: { scene: scenes[1], href: "#", onCopy: noop, onArchive: noop },
} satisfies Meta<typeof SceneListRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Published: Story = {};
export const UnpublishedChanges: Story = { args: { scene: scenes[0] } };
export const NeverPublished: Story = { args: { scene: scenes[2] } };
export const Archived: Story = { args: { scene: scenes[3], onCopy: undefined, onArchive: undefined, onRestore: noop } };
export const ActiveCountUnknown: Story = { args: { scene: { ...scenes[0], activePlacementCount: undefined } } };
export const ReadOnly: Story = { args: { onCopy: undefined, onArchive: undefined } };
export const Busy: Story = { args: { scene: scenes[3], onCopy: undefined, onArchive: undefined, onRestore: noop, busy: true } };
