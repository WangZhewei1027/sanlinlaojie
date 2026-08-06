import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const meta = {
  title: "Design System/Components/Sheet",
  component: Sheet,
  parameters: { layout: "centered", docs: { description: { component: "从视口边缘进入的桌面辅助面板；同屏只保留一层遮罩。" } } },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function SheetExample({ side }: { side: "top" | "right" | "bottom" | "left" }) { return <Sheet><SheetTrigger asChild><Button variant="outline">从 {side} 打开</Button></SheetTrigger><SheetContent side={side}><SheetHeader><SheetTitle>资源详情</SheetTitle><SheetDescription>从 {side} 方向进入的辅助面板。</SheetDescription></SheetHeader><div className="px-4">面板正文区域</div><SheetFooter><SheetClose asChild><Button>完成</Button></SheetClose></SheetFooter></SheetContent></Sheet>; }

export const Right: Story = { render: () => <SheetExample side="right" /> };
export const Left: Story = { render: () => <SheetExample side="left" /> };
export const Top: Story = { render: () => <SheetExample side="top" /> };
export const Bottom: Story = { render: () => <SheetExample side="bottom" /> };
export const Open: Story = { args: { defaultOpen: true }, render: (args) => <Sheet {...args}><SheetContent><SheetHeader><SheetTitle>默认打开</SheetTitle><SheetDescription>用于直接检查面板布局。</SheetDescription></SheetHeader><SheetFooter><SheetClose asChild><Button>关闭</Button></SheetClose></SheetFooter></SheetContent></Sheet> };

