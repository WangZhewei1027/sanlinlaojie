import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { PrincipleCompare, PrincipleExample } from "@/stories/_components/PrincipleExample";

const RULES = ["只使用语义 token，不写死 hex 或调色板颜色。", "muted-foreground 是辅助文字的对比度下限，不再调浅。", "同一视图只有一个 primary 主操作，其余使用 secondary、outline 或 ghost。"];
const meta = { title: "Design System/Foundations/Principles/Color Semantics", parameters: { layout: "padded", docs: { description: { component: "颜色表达语义，不表达装饰偏好。" } } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const DestructiveMeaning: Story = { render: () => <PrincipleCompare><PrincipleExample verdict="dont" note="普通保存使用红色会削弱危险含义。"><div className="flex gap-2"><Button variant="destructive">保存</Button><Button variant="outline">取消</Button></div></PrincipleExample><PrincipleExample verdict="do" note="只有不可逆操作使用 destructive，并配二次确认。"><div className="flex gap-2"><Button>保存</Button><Button variant="destructive">删除资源</Button></div></PrincipleExample></PrincipleCompare> };
export const OnePrimaryAction: Story = { render: () => <PrincipleCompare><PrincipleExample verdict="dont" note="多个 primary 无法表达操作优先级。"><div className="flex gap-2"><Button>保存</Button><Button>发布</Button></div></PrincipleExample><PrincipleExample verdict="do" note="主操作唯一，其他操作降低层级。"><div className="flex gap-2"><Button>发布</Button><Button variant="outline">保存草稿</Button></div></PrincipleExample></PrincipleCompare> };
export const Rules: Story = { render: () => <ul className="list-disc space-y-2 pl-5">{RULES.map((rule) => <li key={rule}><Text as="p">{rule}</Text></li>)}</ul> };

