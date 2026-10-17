import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneToolbar } from "../../../app/manage/scenes/components/SceneToolbar";
import { ContentStatusBadge } from "../../../app/manage/content/ContentStatusBadge";
import "../../../app/manage/scenes/components/scene-editor.css";
const noop = () => {};
const meta = {
  title: "Manage/Content Integration/Scene Toolbar", component: SceneToolbar, parameters: { layout: "fullscreen" },
  args: { title: "老街舞台演出", dirty: false, saving: false, preview: false, canUndo: false, canRedo: false, onTitle: noop, onPreview: noop, onSave: noop, onUndo: noop, onRedo: noop, backHref: "/manage/scenes", onPublish: noop, publishLabel: "发布" },
} satisfies Meta<typeof SceneToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PublishedDraft: Story = { args: { status: <ContentStatusBadge kind="published" number={3} /> } };
export const UnsavedBeforePublish: Story = { args: { dirty: true, canUndo: true, publishDisabled: true, publishLabel: "先保存草稿再发布", status: <ContentStatusBadge kind="changed" number={3} /> } };
export const ReadOnlyViewer: Story = { args: { readOnly: true, onPublish: undefined, status: <ContentStatusBadge kind="published" number={3} /> } };
