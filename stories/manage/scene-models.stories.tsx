import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneModels } from "../../app/manage/scenes/components/SceneModels";
import "../../app/manage/scenes/components/scene-editor.css";
const noop = () => {};
const meta = {
  title: "Manage/Scene Editor/Hierarchy", component: SceneModels, parameters: { layout: "padded" },
  decorators: [(Story) => <div className="h-[560px] w-64 [&>aside]:h-full"><Story /></div>],
  args: { models: [], instances: [], names: {}, selectedId: null, canAdd: true, onAdd: noop, onSelect: noop },
} satisfies Meta<typeof SceneModels>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NoModels: Story = {};
export const ProjectAssets: Story = { args: { models: [{ id: "model", name: "舞者", file_url: "/fixture.glb" }] } };
export const SelectedObject: Story = { args: { ...ProjectAssets.args, instances: [{ id: "dancer_1", asset: "dancer", position: [0,0,0], quaternion: [0,0,0,1], scale: [1,1,1], animation: null }], names: { dancer_1: "舞者" }, selectedId: "dancer_1" } };
