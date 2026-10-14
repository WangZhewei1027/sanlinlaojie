import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneToolbar } from "../../app/manage/scenes/components/SceneToolbar";
import "../../app/manage/scenes/components/scene-editor.css";
const noop = () => {};
const meta = {
  title: "Manage/Scene Editor/Toolbar", component: SceneToolbar, parameters: { layout: "fullscreen" },
  args: { title: "老街舞台演出", dirty: false, saving: false, preview: false, canUndo: false, canRedo: false, onTitle: noop, onPreview: noop, onSave: noop, onUndo: noop, onRedo: noop },
} satisfies Meta<typeof SceneToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Saved: Story = {};
export const Unsaved: Story = { args: { dirty: true, canUndo: true } };
export const Previewing: Story = { args: { preview: true } };
export const Saving: Story = { args: { saving: true, dirty: true } };
