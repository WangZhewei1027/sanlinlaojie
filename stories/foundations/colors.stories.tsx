import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text } from "@/components/ui/typography";
import "@/app/manage/scenes/components/scene-workspace-theme.css";

function Swatch({ name, variable, surface }: { name: string; variable: string; surface: string }) {
  return <div className="w-36"><div className={`h-16 rounded-md border ${surface}`} /><Text as="div" variant="bodySm" tone="default" fontWeight="medium" className="mt-2">{name}</Text><Text as="div" variant="bodyXs" tone="subdued" className="font-mono">{variable}</Text></div>;
}

function Palette({ children }: { children: React.ReactNode }) { return <div className="flex flex-wrap gap-5">{children}</div>; }

const meta = {
  title: "Design System/Foundations/Tokens/Colors",
  parameters: { layout: "padded", docs: { description: { component: "来自 app/globals.css 的正式语义颜色。使用工具栏切换 Light/Dark 检查两套 token。" } } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BaseSurfaces: Story = { render: () => <Palette><Swatch surface="bg-background" name="background" variable="--background" /><Swatch surface="bg-foreground" name="foreground" variable="--foreground" /><Swatch surface="bg-card" name="card" variable="--card" /><Swatch surface="bg-popover" name="popover" variable="--popover" /></Palette> };
export const BrandAndInteraction: Story = { render: () => <Palette><Swatch surface="bg-primary" name="primary" variable="--primary" /><Swatch surface="bg-secondary" name="secondary" variable="--secondary" /><Swatch surface="bg-muted" name="muted" variable="--muted" /><Swatch surface="bg-accent" name="accent" variable="--accent" /></Palette> };
export const Status: Story = { render: () => <Palette><Swatch surface="bg-success" name="success" variable="--success" /><Swatch surface="bg-warning" name="warning" variable="--warning" /><Swatch surface="bg-destructive" name="destructive" variable="--destructive" /></Palette> };
export const LinesAndFocus: Story = { render: () => <Palette><Swatch surface="bg-border" name="border" variable="--border" /><Swatch surface="bg-input" name="input" variable="--input" /><Swatch surface="bg-ring" name="ring" variable="--ring" /></Palette> };
export const Charts: Story = { render: () => <Palette>{[1, 2, 3, 4, 5].map((index) => <Swatch key={index} surface={`bg-chart-${index}`} name={`chart-${index}`} variable={`--chart-${index}`} />)}</Palette> };
export const Radius: Story = { render: () => <div className="flex flex-wrap gap-5"><div className="h-20 w-32 rounded-sm border bg-muted p-3">rounded-sm</div><div className="h-20 w-32 rounded-md border bg-muted p-3">rounded-md</div><div className="h-20 w-32 rounded-lg border bg-muted p-3">rounded-lg</div></div> };

export const SceneWorkspace: Story = { render: () => <div className="scene-workspace-theme space-y-6 rounded-md p-6"><Text as="h2" variant="headingMd">场景工作台</Text><Text as="p" variant="bodySm" tone="subdued">标题、工具与变换时间轴固定使用 Light 主题；切换全站主题可验证工作台与浮层保持浅色。</Text><Palette><Swatch surface="bg-background" name="background" variable="--background" /><Swatch surface="bg-popover" name="popover" variable="--popover" /><Swatch surface="bg-muted" name="muted" variable="--muted" /><Swatch surface="bg-accent" name="selected / hover" variable="--accent" /><Swatch surface="bg-input" name="input" variable="--input" /></Palette><div className="flex gap-4"><Text as="span" variant="bodySm" tone="success">已保存</Text><Text as="span" variant="bodySm" tone="warning">未保存</Text><Text as="span" variant="bodySm" tone="critical">加载失败</Text></div></div> };

