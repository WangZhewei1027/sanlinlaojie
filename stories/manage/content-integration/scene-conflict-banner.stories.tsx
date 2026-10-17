import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneConflictBanner } from "../../../app/manage/scenes/components/SceneConflictBanner";
const meta = {
  title: "Manage/Content Integration/Scene Conflict Banner", component: SceneConflictBanner, parameters: { layout: "fullscreen" },
  args: { draftJson: () => "{\"schemaVersion\":3}", fileName: "scene-draft.json", onReload: () => {}, onDismiss: () => {} },
} satisfies Meta<typeof SceneConflictBanner>;
export default meta;
type Story = StoryObj<typeof meta>;
export const StaleLock: Story = {};
