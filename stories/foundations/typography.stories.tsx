import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text, type TextElement, type TextVariant } from "@/components/ui/typography";

const SCALE: Array<{ variant: TextVariant; element: TextElement; size: string; usage: string }> = [
  { variant: "headingXl", element: "h1", size: "30px", usage: "页面主标题，每页仅一个" },
  { variant: "headingLg", element: "h2", size: "24px", usage: "区块标题" },
  { variant: "headingMd", element: "h3", size: "18px", usage: "小节或卡片标题" },
  { variant: "bodyMd", element: "p", size: "16px", usage: "正文最小字号" },
  { variant: "bodySm", element: "p", size: "14px", usage: "辅助信息" },
  { variant: "bodyXs", element: "small", size: "12px", usage: "组件级微文本" },
];

const meta = {
  title: "Design System/Foundations/Tokens/Typography",
  component: Text,
  parameters: { layout: "padded", docs: { description: { component: "统一的 Text API、六级字号、语义 tone 与中西文字体栈。" } } },
  argTypes: {
    as: { control: "select", options: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "div", "small", "strong", "legend"] },
    variant: { control: "select", options: ["headingXl", "headingLg", "headingMd", "bodyMd", "bodySm", "bodyXs"] },
    tone: { control: "select", options: [undefined, "default", "subdued", "critical", "success", "warning"] },
    fontWeight: { control: "select", options: [undefined, "regular", "medium", "semibold", "bold"] },
    alignment: { control: "select", options: [undefined, "start", "center", "end"] },
  },
  args: { as: "p", variant: "bodyMd", children: "三林老街 Sanlin Old Street" },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const TypeScale: Story = { render: () => <div className="space-y-6">{SCALE.map((item) => <div key={item.variant} className="grid items-baseline gap-2 md:grid-cols-[12rem_7rem_1fr]"><Text as={item.element} variant={item.variant}>老街晨光 Aa</Text><Text as="span" variant="bodySm" tone="subdued" className="font-mono">{item.variant} · {item.size}</Text><Text as="span" variant="bodySm" tone="subdued">{item.usage}</Text></div>)}</div> };
export const Tones: Story = { render: () => <div className="space-y-2"><Text as="p" tone="default">Default 正文</Text><Text as="p" tone="subdued">Subdued 辅助信息</Text><Text as="p" tone="critical">Critical 错误信息</Text><Text as="p" tone="success">Success 成功状态</Text><Text as="p" tone="warning">Warning 警示信息</Text></div> };
export const FontWeights: Story = { render: () => <div className="space-y-2"><Text as="p" fontWeight="regular">Regular</Text><Text as="p" fontWeight="medium">Medium</Text><Text as="p" fontWeight="semibold">Semibold</Text><Text as="p" fontWeight="bold">Bold</Text></div> };
export const Alignment: Story = { render: () => <div className="w-full space-y-2"><Text as="p" alignment="start">Start</Text><Text as="p" alignment="center">Center</Text><Text as="p" alignment="end">End</Text></div> };
export const Truncation: Story = { render: () => <Text as="p" truncate className="max-w-64">这是一段超过容器宽度后会被明确截断并显示省略号的文本。</Text> };
export const MixedLanguage: Story = { render: () => <Text as="p">三林老街 Sanlin Old Street — 数字 0123456789 与标点「引号」（括号）。</Text> };
export const ArticleHierarchy: Story = { render: () => <article className="max-w-[65ch] space-y-4"><Text as="h1" variant="headingXl">三林老街数字导览</Text><Text as="small" variant="bodySm" tone="subdued">发布于 2026-08-04 · 阅读约 3 分钟</Text><Text as="p">三林老街是一条保存完好的江南水乡老街。本项目通过增强现实技术，把口述历史与声音档案叠加在真实街景之上。</Text><Text as="h2" variant="headingLg">如何开始体验</Text><Text as="p">扫描街口二维码即可打开小程序，地图会显示附近的 AR 内容点位。</Text><Text as="h3" variant="headingMd">内容类型</Text><Text as="p">目前支持图片、音频、视频与三维模型。</Text></article> };

