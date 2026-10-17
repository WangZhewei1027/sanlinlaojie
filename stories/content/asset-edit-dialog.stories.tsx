import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetEditDialog } from "../../app/manage/content/AssetEditDialog";
import { noop, ok } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Edit Dialog",
  component: AssetEditDialog,
  parameters: { layout: "centered" },
  args: { open: true, onOpenChange: noop, assetName: "走马灯模型", assetType: "model", accept: ".glb,.gltf", onSubmit: ok },
} satisfies Meta<typeof AssetEditDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ModelFile: Story = {};
export const TextContent: Story = { args: { assetName: "老字号招牌介绍", assetType: "text" } };
export const LinkContent: Story = { args: { assetName: "示例链接", assetType: "link" } };
export const ConflictOnSubmit: Story = {
  parameters: { docs: { description: { story: "Type text and submit to see the stale-lock conflict notice; the entered content is kept." } } },
  args: {
    assetType: "text",
    onSubmit: async () => ({ ok: false, kind: "conflict", message: "示例：另一位成员刚刚创建了 v4，请重新载入后再上传。" }),
  },
};
