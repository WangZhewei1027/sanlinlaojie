import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneCopyDialog } from "../../app/manage/content/SceneCopyDialog";
import { noop, ok, sceneRefs } from "./fixtures";

const meta = {
  title: "Manage/Content/Scene Copy Dialog",
  component: SceneCopyDialog,
  parameters: { layout: "centered" },
  args: { scene: sceneRefs.placed, onOpenChange: noop, onCopy: ok },
} satisfies Meta<typeof SceneCopyDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SameTeamCopy: Story = {};
export const CopyFails: Story = {
  parameters: { docs: { description: { story: "Submit to see the failure notice; the dialog stays open with the name kept." } } },
  args: { onCopy: async () => ({ ok: false, kind: "error", message: "示例：网络中断，副本没有创建。" }) },
};
