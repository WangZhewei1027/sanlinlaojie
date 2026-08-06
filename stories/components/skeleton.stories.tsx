import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const meta = {
  title: "Design System/Components/Skeleton",
  component: Skeleton,
  parameters: { layout: "centered", docs: { description: { component: "加载占位应匹配最终内容的形状和尺寸，避免布局跳动。" } } },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextLine: Story = { args: { className: "h-4 w-64" } };
export const Avatar: Story = { args: { className: "size-12 rounded-full" } };
export const Image: Story = { args: { className: "aspect-video w-80" } };
export const ProfileRow: Story = { render: () => <div className="flex items-center gap-4"><Skeleton className="size-12 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-32" /></div></div> };
export const CardLoading: Story = { render: () => <Card className="w-80"><CardHeader className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-48" /></CardHeader><CardContent><Skeleton className="aspect-video w-full" /></CardContent></Card> };

