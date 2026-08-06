import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/ui/badge";

const meta = {
  title: "Design System/Components/Badge",
  component: Badge,
  parameters: { layout: "centered", docs: { description: { component: "短标签与状态标识；不要承载完整句子。" } } },
  argTypes: { variant: { control: "select", options: ["default", "secondary", "destructive", "outline"] } },
  args: { children: "默认标签", variant: "default" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Secondary: Story = { args: { children: "次要", variant: "secondary" } };
export const Destructive: Story = { args: { children: "错误", variant: "destructive" } };
export const Outline: Story = { args: { children: "只读", variant: "outline" } };
export const LongContent: Story = { args: { children: "较长的分类名称" } };

