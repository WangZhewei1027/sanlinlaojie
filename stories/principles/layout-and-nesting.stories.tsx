import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { PrincipleCompare, PrincipleExample } from "@/stories/_components/PrincipleExample";

const meta = { title: "Design System/Foundations/Principles/Layout and Nesting", parameters: { layout: "padded", docs: { description: { component: "使用间距与分隔线表达内部层级，避免容器和遮罩层层嵌套。" } } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const CardNesting: Story = { render: () => <PrincipleCompare><PrincipleExample verdict="dont" note="Card 套 Card 产生双重边框和错误层级。"><Card><CardHeader><CardTitle>资源详情</CardTitle></CardHeader><CardContent><Card><CardContent className="pt-6">元数据</CardContent></Card></CardContent></Card></PrincipleExample><PrincipleExample verdict="do" note="同一容器内使用小节标题与分隔线。"><Card><CardHeader><CardTitle>资源详情</CardTitle></CardHeader><CardContent className="space-y-3"><p>一张三林塘港的老照片。</p><div className="border-t pt-3"><p className="font-medium">元数据</p><p className="text-muted-foreground">拍摄于 2024-05-01</p></div></CardContent></Card></PrincipleExample></PrincipleCompare> };
export const OverlayRules: Story = { render: () => <ul className="list-disc space-y-2 pl-5"><li><Text as="p">Dialog 内不再打开第二个 Dialog；确认内容在同一弹层替换。</Text></li><li><Text as="p">Popover 或 Dropdown 内不打开新的 Popover。</Text></li><li><Text as="p">同屏最多一层 Dialog、Drawer 或 Sheet 遮罩。</Text></li></ul> };

