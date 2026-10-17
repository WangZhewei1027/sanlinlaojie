import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContentThumbnail } from "../../app/manage/content/ContentThumbnail";

const meta = {
  title: "Manage/Content/Thumbnail",
  component: ContentThumbnail,
  parameters: { layout: "centered" },
  args: { type: "model", name: "走马灯模型" },
} satisfies Meta<typeof ContentThumbnail>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ModelWithoutSnapshot: Story = {};
export const Audio: Story = { args: { type: "audio", name: "评弹导览音频" } };
export const Text: Story = { args: { type: "text", name: "招牌介绍", textExcerpt: "示例文字：这块招牌记录了街区商号的变迁。" } };
export const Video: Story = { args: { type: "video", name: "示例视频" } };
export const Link: Story = { args: { type: "link", name: "示例链接" } };
export const Document: Story = { args: { type: "document", name: "示例文档" } };
