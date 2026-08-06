import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Text } from "@/components/ui/typography";
import { PrincipleCompare, PrincipleExample } from "@/stories/_components/PrincipleExample";

const meta = { title: "Design System/Foundations/Principles/Touch and Responsive", parameters: { layout: "padded", docs: { description: { component: "功能不能依赖 hover；触控目标、长文案和窄视口必须保持可用。" } } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const PersistentActions: Story = { render: () => <PrincipleCompare><PrincipleExample verdict="dont" note="hover 才出现的按钮在触屏设备上不可发现。"><div className="group flex items-center justify-between rounded-md border p-3"><span>老照片.jpg</span><div className="opacity-0 group-hover:opacity-100"><Button size="sm" variant="ghost">编辑</Button></div></div></PrincipleExample><PrincipleExample verdict="do" note="更多操作入口始终可见，hover 只增强视觉。"><div className="flex items-center justify-between rounded-md border p-3"><span>老照片.jpg</span><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="更多操作"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>编辑</DropdownMenuItem><DropdownMenuItem className="text-destructive">删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></PrincipleExample></PrincipleCompare> };
export const TouchTarget: Story = { render: () => <div className="space-y-3"><Button size="icon" variant="outline" aria-label="更多操作"><MoreHorizontal /></Button><Text as="p" tone="subdued">图标按钮使用标准 icon 尺寸并提供 accessible name。</Text></div> };
export const LongLocalizedContent: Story = { parameters: { viewport: { defaultViewport: "mobile1" } }, render: () => <div className="max-w-sm space-y-3 rounded-md border p-4"><Text as="h2" variant="headingMd">邀请新的组织成员加入三林老街数字文化遗产管理平台</Text><Text as="p">英文文案可能比中文长 50–200%，容器必须允许换行并避免固定高度。</Text><Button className="w-full">发送邀请</Button></div> };
export const Rules: Story = { render: () => <ul className="list-disc space-y-2 pl-5"><li><Text as="p">hover 只做视觉增强，不承载唯一入口。</Text></li><li><Text as="p">移动端操作面板优先使用底部 Drawer。</Text></li><li><Text as="p">全屏高度使用 dvh，避免浏览器地址栏遮挡。</Text></li></ul> };

