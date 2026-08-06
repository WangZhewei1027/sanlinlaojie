import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

const meta = {
  title: "Design System/Components/Popover",
  component: Popover,
  parameters: { layout: "centered", docs: { description: { component: "与触发器相关的非阻断浮层；复杂任务改用 Dialog 或 Sheet。" } } },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = { render: () => <Popover><PopoverTrigger asChild><Button variant="outline">查看说明</Button></PopoverTrigger><PopoverContent><PopoverHeader><PopoverTitle>资源位置</PopoverTitle><PopoverDescription>点击地图即可选择资源放置位置。</PopoverDescription></PopoverHeader></PopoverContent></Popover> };
export const WithForm: Story = { render: () => <Popover><PopoverTrigger asChild><Button variant="outline">编辑尺寸</Button></PopoverTrigger><PopoverContent><PopoverHeader><PopoverTitle>显示尺寸</PopoverTitle><PopoverDescription>设置地图中资源的显示宽度。</PopoverDescription></PopoverHeader><div className="mt-4 grid grid-cols-3 items-center gap-2"><Label htmlFor="story-width">宽度</Label><Input id="story-width" defaultValue="320" className="col-span-2" /></div></PopoverContent></Popover> };
export const Open: Story = { args: { defaultOpen: true }, render: (args) => <Popover {...args}><PopoverTrigger asChild><Button variant="outline">锚点</Button></PopoverTrigger><PopoverContent><PopoverHeader><PopoverTitle>默认打开</PopoverTitle><PopoverDescription>用于直接检查浮层布局。</PopoverDescription></PopoverHeader></PopoverContent></Popover> };

