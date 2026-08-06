import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const meta = {
  title: "Design System/Components/Card",
  component: Card,
  parameters: { layout: "centered", docs: { description: { component: "相关内容与操作的单层容器。Card 内禁止再嵌套 Card。" } } },
  decorators: [(Story) => <div className="w-96 max-w-[calc(100vw-2rem)]"><Story /></div>],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = { render: () => <Card><CardHeader><CardTitle>资源详情</CardTitle><CardDescription>三林老街的历史影像资料。</CardDescription></CardHeader><CardContent>卡片正文内容区域。</CardContent></Card> };
export const WithActions: Story = { render: () => <Card><CardHeader><CardTitle>发布资源</CardTitle><CardDescription>确认信息后将资源发布到地图。</CardDescription></CardHeader><CardContent>位置：三林塘港</CardContent><CardFooter className="gap-2"><Button>发布</Button><Button variant="outline">取消</Button></CardFooter></Card> };
export const ContentOnly: Story = { render: () => <Card><CardContent className="pt-6">无需标题的紧凑内容。</CardContent></Card> };
export const LongContent: Story = { render: () => <Card><CardHeader><CardTitle>一段较长的卡片标题，用于确认标题换行后的布局表现</CardTitle><CardDescription>英文和中文内容长度不同，容器不应依赖固定高度。</CardDescription></CardHeader><CardContent>Sanlin Old Street digital heritage archive.</CardContent></Card> };

