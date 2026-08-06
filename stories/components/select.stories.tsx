import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

const meta = {
  title: "Design System/Components/Select",
  component: Select,
  parameters: { layout: "centered", docs: { description: { component: "从有限选项中选择一个值；使用 Label 提供可见名称。" } } },
  args: {},
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

function SelectExample({ disabled = false, size = "default" }: { disabled?: boolean; size?: "sm" | "default" }) { return <Select disabled={disabled}><SelectTrigger size={size} className="w-56"><SelectValue placeholder="选择资源类型" /></SelectTrigger><SelectContent><SelectGroup><SelectLabel>媒体</SelectLabel><SelectItem value="image">图片</SelectItem><SelectItem value="video">视频</SelectItem><SelectItem value="audio">音频</SelectItem></SelectGroup><SelectSeparator /><SelectGroup><SelectLabel>其他</SelectLabel><SelectItem value="document">文档</SelectItem><SelectItem value="link">链接</SelectItem></SelectGroup></SelectContent></Select>; }

export const Basic: Story = { render: () => <SelectExample /> };
export const DefaultValue: Story = { render: () => <Select defaultValue="image"><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">图片</SelectItem><SelectItem value="video">视频</SelectItem></SelectContent></Select> };
export const Small: Story = { render: () => <SelectExample size="sm" /> };
export const Disabled: Story = { render: () => <SelectExample disabled /> };
export const WithLabel: Story = { render: () => <div className="grid gap-1.5"><Label htmlFor="story-select">资源类型</Label><Select><SelectTrigger id="story-select" className="w-56"><SelectValue placeholder="请选择" /></SelectTrigger><SelectContent><SelectItem value="image">图片</SelectItem><SelectItem value="audio">音频</SelectItem></SelectContent></Select></div> };

