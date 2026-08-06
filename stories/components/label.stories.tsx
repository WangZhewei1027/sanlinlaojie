import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta = {
  title: "Design System/Components/Label",
  component: Label,
  parameters: { layout: "centered", docs: { description: { component: "表单控件的可见名称，通过 htmlFor 与控件关联。" } } },
  args: { children: "字段标签" },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const WithInput: Story = { render: () => <div className="grid w-80 gap-1.5"><Label htmlFor="story-name">资源名称</Label><Input id="story-name" placeholder="请输入资源名称" /></div> };
export const WithCheckbox: Story = { render: () => <div className="flex items-center gap-2"><Checkbox id="story-terms" /><Label htmlFor="story-terms">我已阅读并同意条款</Label></div> };
export const DisabledControl: Story = { render: () => <div className="flex items-center gap-2"><Checkbox id="story-disabled" disabled /><Label htmlFor="story-disabled">不可选择</Label></div> };

