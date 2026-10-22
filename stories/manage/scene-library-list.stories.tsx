import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneLibraryList } from "../../app/manage/scenes/components/SceneLibraryList";
import "../../app/manage/scenes/components/scene-editor.css";
const resource = { assetId: "lantern", assetLockVersion: 1, name: "街巷灯笼", url: "/lantern.glb", assetState: "active" as const };
const meta = {
  title: "Manage/Scene Editor/Model Assets", component: SceneLibraryList,
  decorators: [(Story) => <div className="w-64 border"><Story /></div>],
  args: { view: "scene", inScene: [{ alias: "lantern", resource, instanceCount: 2 }], items: [], selectedAlias: "lantern", canAdd: true, search: "", loading: false, onRegister: () => {}, onAdd: () => {}, onSelectAlias: () => {} },
} satisfies Meta<typeof SceneLibraryList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Selected: Story = {};
export const EmptyScene: Story = { args: { inScene: [] } };
export const Loading: Story = { args: { view: "team", loading: true } };
export const EmptySearch: Story = { args: { view: "team", search: "tower" } };
export const MissingFile: Story = { args: { inScene: [{ alias: "lantern", resource: { ...resource, url: null }, instanceCount: 1 }] } };
export const AtObjectLimit: Story = { args: { canAdd: false } };
