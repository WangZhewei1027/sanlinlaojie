import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const meta = {
  title: "Design System/Components/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered", docs: { description: { component: "二元选择控件；始终提供可见 Label。" } } },
  args: { id: "story-checkbox" },
  render: (args) => <div className="flex items-center gap-2"><Checkbox {...args} /><Label htmlFor={args.id}>接收更新通知</Label></div>,
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = { args: { checked: "indeterminate" } };
export const Disabled: Story = { args: { disabled: true } };
export const DisabledChecked: Story = { args: { disabled: true, defaultChecked: true } };

