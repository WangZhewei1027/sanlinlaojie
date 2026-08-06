import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Design System/Components/Button",
  component: Button,
  parameters: {
    layout: "centered",
    docs: { description: { component: "操作按钮。一个视图只保留一个 primary；不可逆操作才使用 destructive。" } },
  },
  argTypes: {
    variant: { control: "select", options: ["default", "secondary", "destructive", "outline", "ghost", "link"] },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
    asChild: { control: false },
  },
  args: { children: "主要操作", variant: "default", size: "default" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Secondary: Story = { args: { children: "次要操作", variant: "secondary" } };
export const Destructive: Story = { args: { children: "删除资源", variant: "destructive" } };
export const Outline: Story = { args: { children: "取消", variant: "outline" } };
export const Ghost: Story = { args: { children: "更多", variant: "ghost" } };
export const Link: Story = { args: { children: "查看详情", variant: "link" } };
export const Small: Story = { args: { children: "小按钮", size: "sm" } };
export const Large: Story = { args: { children: "大按钮", size: "lg" } };
export const Disabled: Story = { args: { children: "不可操作", disabled: true } };
export const WithLeadingIcon: Story = { args: { children: <><Plus />新增资源</> } };
export const WithTrailingIcon: Story = { args: { children: <>下一步<ArrowRight /></> } };
export const Loading: Story = { args: { children: <><Loader2 className="animate-spin" />处理中</>, disabled: true, "aria-busy": true } };
export const IconOnly: Story = { args: { children: <Plus />, size: "icon", "aria-label": "新增资源" } };

