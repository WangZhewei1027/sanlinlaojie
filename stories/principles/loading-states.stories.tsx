import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import { PrincipleCompare, PrincipleExample } from "@/stories/_components/PrincipleExample";

const meta = { title: "Design System/Foundations/Principles/Loading States", parameters: { layout: "padded", docs: { description: { component: "内容区域使用等尺寸 Skeleton；spinner 仅用于尺寸不变的按钮提交状态。" } } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ContentLoading: Story = { render: () => <PrincipleCompare><PrincipleExample verdict="dont" note="居中 spinner 与最终内容高度无关，会导致布局跳动。"><Card><CardHeader><CardTitle>资源详情</CardTitle></CardHeader><CardContent className="flex justify-center gap-2"><Loader2 className="size-4 animate-spin" />加载中…</CardContent></Card></PrincipleExample><PrincipleExample verdict="do" note="Skeleton 匹配标题、正文和图片的最终形状。"><Card><CardHeader className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-48" /></CardHeader><CardContent><Skeleton className="aspect-video w-full" /></CardContent></Card></PrincipleExample></PrincipleCompare> };
export const ListLoading: Story = { render: () => <div className="w-full max-w-xl space-y-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="flex items-center gap-3"><Skeleton className="size-10 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div>)}</div> };
export const ButtonLoading: Story = { render: () => <Button disabled aria-busy="true"><Loader2 className="animate-spin" />正在发布</Button> };
export const Rules: Story = { render: () => <ul className="list-disc space-y-2 pl-5"><li><Text as="p">Skeleton 的数量按真实内容典型数量摆放。</Text></li><li><Text as="p">图片占位使用固定宽高比。</Text></li><li><Text as="p">加载完成后原地替换，不改变周围布局。</Text></li></ul> };

