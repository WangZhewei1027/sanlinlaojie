import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const meta = {
  title: "Design System/Components/Textarea",
  component: Textarea,
  parameters: { layout: "centered", docs: { description: { component: "多行文本输入，容器决定宽度。" } } },
  args: { placeholder: "请输入备注信息", rows: 4 },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const WithValue: Story = { args: { defaultValue: "这是一段已有的备注信息。" } };
export const Disabled: Story = { args: { disabled: true, placeholder: "不可编辑" } };
export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "内容不符合要求" } };
export const WithLabel: Story = {
  render: (args) => <div className="grid gap-1.5"><Label htmlFor="story-notes">备注</Label><Textarea {...args} id="story-notes" /></div>,
};

