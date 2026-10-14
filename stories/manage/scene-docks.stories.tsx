import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneDockLayout } from "../../app/manage/scenes/components/SceneDockLayout";
import "../../app/manage/scenes/components/scene-editor.css";
const pane = (name: string) => <div className="h-full border bg-background p-4">{name}</div>;
const meta = {
  title: "Manage/Scene Editor/Resizable Docks", component: SceneDockLayout,
  parameters: {layout:"fullscreen"}, decorators: [(Story) => <div className="flex h-[640px] flex-col"><Story /></div>],
  args: { objects: pane("层级与项目素材"), scene: pane("场景视图"), inspector: pane("属性"), timeline: pane("时间轴"), mobilePanel:"scene", preview:false },
} satisfies Meta<typeof SceneDockLayout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Workbench: Story = {};
export const Preview: Story = {args:{preview:true}};
