import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

const meta = {
  title: "Design System/Components/Drawer",
  component: Drawer,
  parameters: { layout: "centered", docs: { description: { component: "触屏优先的操作面板；移动端操作默认从底部进入。" } } },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

function DrawerExample({ direction = "bottom" }: { direction?: "top" | "bottom" | "left" | "right" }) {
  return <Drawer direction={direction}><DrawerTrigger asChild><Button variant="outline">从 {direction} 打开</Button></DrawerTrigger><DrawerContent><DrawerHeader><DrawerTitle>资源操作</DrawerTitle><DrawerDescription>选择要对当前资源执行的操作。</DrawerDescription></DrawerHeader><div className="px-4 py-2">抽屉正文区域</div><DrawerFooter><Button>确认</Button><DrawerClose asChild><Button variant="outline">取消</Button></DrawerClose></DrawerFooter></DrawerContent></Drawer>;
}

export const Bottom: Story = { render: () => <DrawerExample /> };
export const Top: Story = { render: () => <DrawerExample direction="top" /> };
export const Left: Story = { render: () => <DrawerExample direction="left" /> };
export const Right: Story = { render: () => <DrawerExample direction="right" /> };
export const Open: Story = { args: { defaultOpen: true }, render: (args) => <Drawer {...args}><DrawerContent><DrawerHeader><DrawerTitle>默认打开</DrawerTitle><DrawerDescription>用于直接检查移动端抽屉布局。</DrawerDescription></DrawerHeader><DrawerFooter><DrawerClose asChild><Button>关闭</Button></DrawerClose></DrawerFooter></DrawerContent></Drawer> };

