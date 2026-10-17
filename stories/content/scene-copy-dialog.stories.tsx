import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneCopyDialog } from "../../app/manage/content/SceneCopyDialog";
import { noop, ok, projects, scenes } from "./fixtures";

const meta = {
  title: "Manage/Content/Scene Copy Dialog",
  component: SceneCopyDialog,
  parameters: { layout: "centered" },
  args: {
    scene: scenes[1],
    onOpenChange: noop,
    sourceProjectId: projects.street.id,
    targets: [projects.street, projects.festival, projects.school, projects.closed],
    onCopy: ok,
  },
} satisfies Meta<typeof SceneCopyDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SameProject: Story = {};
export const MissingGrantsInTarget: Story = {
  parameters: { docs: { description: { story: "Choose another project and submit to see the refusal listing restricted assets." } } },
  args: { onCopy: async () => ({ ok: false, kind: "conflict", message: "示例：以下受限素材尚未授权给目标项目。", details: ["石桥立面照片（维护者：示例成员 周）"] }) },
};
