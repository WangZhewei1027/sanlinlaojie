import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "../../components/ui/button";
import { ContentEmptyState, ContentErrorState, ContentFailureNotice, ContentListSkeleton, ContentNotice } from "../../app/manage/content/ContentFeedback";
import { noop } from "./fixtures";

const meta = {
  title: "Manage/Content/Feedback",
  component: ContentNotice,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
  args: { tone: "info", title: "此素材已归档", description: "已有场景和投放继续使用固定版本；不能新增引用。" },
} satisfies Meta<typeof ContentNotice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const InfoNotice: Story = {};
export const WarningNoticeWithAction: Story = {
  args: { tone: "warning", title: "素材已被他人修改", description: "你看到的信息已过期，刚才的修改没有保存。", action: <Button variant="outline" size="sm">重新载入</Button> },
};
export const CriticalNotice: Story = { args: { tone: "critical", title: "当前版本的文件缺失", description: "引用此版本的内容不能发布。" } };
export const ConflictWithImpact: Story = {
  render: () => <ContentFailureNotice failure={{ ok: false, kind: "conflict", details: ["示例项目 研学路线 · 草稿“校园路线”", "示例项目 研学路线 · 投放“操场入口”"] }} />,
};
export const Forbidden: Story = { render: () => <ContentFailureNotice failure={{ ok: false, kind: "forbidden", message: "示例：只有维护者或组织管理员可以修改共享范围。" }} /> };
export const EmptyWithActions: Story = {
  render: () => <ContentEmptyState title="这个项目还没有素材" description="上传新素材，或把组织共享的素材加入本项目。" actions={<Button variant="outline" size="sm">浏览组织共享素材</Button>} />,
};
export const LoadFailed: Story = { render: () => <ContentErrorState onRetry={noop} /> };
export const ListLoading: Story = { render: () => <div className="rounded-lg border"><ContentListSkeleton rows={4} label="正在加载" /></div> };
