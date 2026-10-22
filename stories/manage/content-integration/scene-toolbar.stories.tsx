import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeChatQrButton } from "@/components/wechat-qr-button";
import { SceneToolbar } from "../../../app/manage/scenes/components/SceneToolbar";
import "../../../app/manage/scenes/components/scene-editor.css";
const noop = () => {};
const meta = {
  title: "Manage/Content Integration/Scene Toolbar", component: SceneToolbar, parameters: { layout: "fullscreen" },
  args: { title: "老街舞台演出", dirty: false, saving: false, preview: false, canUndo: false, canRedo: false, onTitle: noop, onPreview: noop, onSave: noop, onUndo: noop, onRedo: noop, backHref: "/manage/scenes", qr: <WeChatQrButton label="微信扫码预览" title="微信扫码预览场景" load={async () => ({ error: "二维码暂时不可用，请重试" })} /> },
} satisfies Meta<typeof SceneToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Saved: Story = {};
export const Unsaved: Story = { args: { dirty: true, canUndo: true } };
export const ReadOnlyViewer: Story = { args: { readOnly: true } };
export const NativeWorkspace: Story = { args: { panelOpen: true, onTogglePanel: noop }, decorators: [(Story) => <div className="scene-workspace-theme"><Story /></div>] };
