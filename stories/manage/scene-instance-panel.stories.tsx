import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneInstancePanel } from "../../app/manage/scenes/components/SceneInstancePanel";
import "../../app/manage/scenes/components/scene-editor.css";
const meta = {
  title: "Manage/Scene Editor/Selected Object", component: SceneInstancePanel,
  decorators: [(Story) => <div className="w-64 border"><Story /></div>],
  args: { instance: { id: "lantern", asset: "lantern", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], animation: { clipIndex: 0, startSeconds: 1, loop: false } }, resource: { assetId: "lantern", assetLockVersion: 1, name: "街巷灯笼", url: "/lantern.glb", assetState: "active" }, clips: [{ name: "Sway", duration: 4 }], assetHref: "#asset", readOnly: false, playing: false, onAnimation: () => {}, onRemove: () => {} },
} satisfies Meta<typeof SceneInstancePanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Selected: Story = {};
export const EmptySelection: Story = { args: { instance: undefined, resource: undefined } };
export const Playing: Story = { args: { playing: true } };
export const ReadOnly: Story = { args: { readOnly: true } };
export const LongModelName: Story = { args: { resource: { ...meta.args.resource, name: "Old Street Lantern Installation — Evening Performance Model" } } };
