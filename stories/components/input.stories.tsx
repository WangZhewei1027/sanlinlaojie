import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta = {
  title: "Design System/Components/Input",
  component: Input,
  parameters: { layout: "centered", docs: { description: { component: "单行文本输入。可见标签优先于仅使用 placeholder。" } } },
  args: { placeholder: "请输入内容" },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const WithValue: Story = { args: { defaultValue: "三林老街" } };
export const Password: Story = { args: { type: "password", placeholder: "请输入密码" } };
export const Disabled: Story = { args: { disabled: true, placeholder: "不可编辑" } };
export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "格式错误" } };
export const WithLabel: Story = {
  render: (args) => <div className="grid gap-1.5"><Label htmlFor="story-email">邮箱</Label><Input {...args} id="story-email" type="email" /></div>,
  args: { placeholder: "you@example.com" },
};

