import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneArchiveDialog } from "../../app/manage/content/SceneArchiveDialog";
import { noop, ok, scenes } from "./fixtures";

const meta = {
  title: "Manage/Content/Scene Archive Dialog",
  component: SceneArchiveDialog,
  parameters: { layout: "centered" },
  args: { scene: scenes[0], onOpenChange: noop, onArchive: ok },
} satisfies Meta<typeof SceneArchiveDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithPlacements: Story = {};
export const NeverPlaced: Story = { args: { scene: scenes[2] } };
export const ActiveCountUnknown: Story = { args: { scene: { ...scenes[0], activePlacementCount: undefined } } };
