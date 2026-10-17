import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneNameDialog } from "../../app/manage/content/SceneNameDialog";
import { noop, ok } from "./fixtures";

const meta = {
  title: "Manage/Content/Scene Name Dialog",
  component: SceneNameDialog,
  parameters: { layout: "centered" },
  args: {
    open: true,
    onOpenChange: noop,
    title: "新建场景",
    description: "场景属于项目“示例项目 老街导览”。创建后会打开编辑器。",
    submitLabel: "创建并打开",
    onSubmit: ok,
  },
} satisfies Meta<typeof SceneNameDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CreateScene: Story = {};
export const CreateFails: Story = {
  parameters: { docs: { description: { story: "Enter a name and submit to see the failure notice; the dialog stays open with the name kept." } } },
  args: { onSubmit: async () => ({ ok: false, kind: "error", message: "示例：网络中断，场景没有创建。" }) },
};
