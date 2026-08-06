"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

const meta = {
  title: "Design System/Components/Toast",
  component: Toaster,
  parameters: { layout: "centered", docs: { description: { component: "短暂的全局反馈。Storybook Preview 已统一挂载 Toaster。" } } },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <Button variant="outline" onClick={() => toast("资源已保存")}>显示普通消息</Button> };
export const Success: Story = { render: () => <Button variant="outline" onClick={() => toast.success("发布成功")}>显示成功消息</Button> };
export const Error: Story = { render: () => <Button variant="outline" onClick={() => toast.error("发布失败，请重试")}>显示错误消息</Button> };
export const Warning: Story = { render: () => <Button variant="outline" onClick={() => toast.warning("部分字段尚未填写")}>显示警告消息</Button> };
export const WithDescription: Story = { render: () => <Button variant="outline" onClick={() => toast("资源已保存", { description: "2026-08-04 14:30" })}>显示详细消息</Button> };
export const WithAction: Story = { render: () => <Button variant="outline" onClick={() => toast("资源已移动", { action: { label: "撤销", onClick: () => toast("已撤销") } })}>显示可撤销消息</Button> };
