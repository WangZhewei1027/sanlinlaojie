import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneArchiveDialog } from "../../app/manage/content/SceneArchiveDialog";
import { noop, ok, sceneRefs } from "./fixtures";

const meta = {
  title: "Manage/Content/Scene Archive Dialog",
  component: SceneArchiveDialog,
  parameters: { layout: "centered" },
  args: { scene: sceneRefs.placed, onOpenChange: noop, onArchive: ok },
} satisfies Meta<typeof SceneArchiveDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithPlacements: Story = {};
export const NeverPlaced: Story = { args: { scene: sceneRefs.unplaced } };
export const ActiveCountUnknown: Story = { args: { scene: { ...sceneRefs.placed, activePlacementCount: undefined } } };
