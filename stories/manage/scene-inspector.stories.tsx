import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneInspector } from "../../app/manage/scenes/components/SceneInspector";
import "../../app/manage/scenes/components/scene-editor.css";
const noop = () => {};
const meta = {
  title: "Manage/Scene Editor/Inspector", component: SceneInspector, parameters: { layout: "padded" },
  decorators: [(Story) => <div className="h-[650px] w-72 [&>aside]:h-full"><Story /></div>],
  args: { time: 0, duration: 10, record: false, playing: false, onTransform: noop, onKey: noop, onAnimation: noop, onRemove: noop },
} satisfies Meta<typeof SceneInspector>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NoSelection: Story = {};
export const StaticModel: Story = { args: { instance: { id: "dancer", asset: "model", position: [0,0,0], quaternion: [0,0,0,1], scale: [1,1,1], animation: null }, name: "舞者", values: { position: {x:0,y:0,z:0}, rotation: {x:0,y:0,z:0}, scale:{x:1,y:1,z:1} }, clips: [] } };
export const AnimatedModel: Story = { args: { ...StaticModel.args, instance: { ...StaticModel.args!.instance!, animation: {clipIndex:0,startSeconds:2,loop:true} }, record: true, clips: [{name:"Dance",duration:4.2}] } };
export const Playback: Story = { args: { ...AnimatedModel.args, record: false, playing: true } };
