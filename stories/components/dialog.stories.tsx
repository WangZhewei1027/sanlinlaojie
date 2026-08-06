import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const meta = {
  title: "Design System/Components/Dialog",
  component: Dialog,
  parameters: { layout: "centered", docs: { description: { component: "阻断式桌面弹层，用于简短任务或确认；不要叠加第二层 Dialog。" } } },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function DialogExample({ destructive = false, long = false, showCloseButton = true }: { destructive?: boolean; long?: boolean; showCloseButton?: boolean }) {
  return <Dialog><DialogTrigger asChild><Button variant="outline">打开对话框</Button></DialogTrigger><DialogContent showCloseButton={showCloseButton}><DialogHeader><DialogTitle>{destructive ? "删除资源？" : "发布资源"}</DialogTitle><DialogDescription>{destructive ? "此操作不可撤销，资源及其关联文件将被永久删除。" : "确认信息后，资源将出现在地图中。"}</DialogDescription></DialogHeader>{long && <div className="space-y-4"><p>较长内容会在弹层内部滚动，而不是超出视口。</p>{Array.from({ length: 8 }, (_, index) => <p key={index}>内容段落 {index + 1}：用于验证最大高度与滚动行为。</p>)}</div>}<DialogFooter><DialogClose asChild><Button variant="outline">取消</Button></DialogClose><Button variant={destructive ? "destructive" : "default"}>{destructive ? "确认删除" : "发布"}</Button></DialogFooter></DialogContent></Dialog>;
}

export const Basic: Story = { render: () => <DialogExample /> };
export const DestructiveConfirmation: Story = { render: () => <DialogExample destructive /> };
export const LongContent: Story = { render: () => <DialogExample long /> };
export const WithoutTopClose: Story = { render: () => <DialogExample showCloseButton={false} /> };
export const Open: Story = { args: { defaultOpen: true }, render: (args) => <Dialog {...args}><DialogContent><DialogHeader><DialogTitle>默认打开</DialogTitle><DialogDescription>用于直接检查弹层布局。</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button>关闭</Button></DialogClose></DialogFooter></DialogContent></Dialog> };

