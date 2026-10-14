import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ScenePanelResizer } from "../../app/manage/scenes/components/ScenePanelResizer";
import "../../app/manage/scenes/components/scene-editor.css";
const meta = {
  title: "Manage/Scene Editor/Dock Separator", component: ScenePanelResizer,
  decorators: [(Story) => <div className="relative h-40 w-64 border bg-muted"><Story /></div>],
  args: { label: "调整面板宽度", value: 232, min: 180, max: 320, onResize: () => {} },
} satisfies Meta<typeof ScenePanelResizer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Vertical: Story = {};
export const Horizontal: Story = { args: { vertical: false, reverse: true, label: "调整时间轴高度" } };
