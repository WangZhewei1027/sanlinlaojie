import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const meta = {
  title: "Design System/Components/Tabs",
  component: Tabs,
  parameters: { layout: "centered", docs: { description: { component: "在同一上下文中切换并列内容，不用于页面级导航。" } } },
  args: { defaultValue: "account", orientation: "horizontal" },
  render: (args) => <Tabs {...args} className="w-[28rem] max-w-[calc(100vw-2rem)]"><TabsList><TabsTrigger value="account">账户</TabsTrigger><TabsTrigger value="password">密码</TabsTrigger><TabsTrigger value="notifications">通知</TabsTrigger></TabsList><TabsContent value="account" className="pt-3">账户设置内容。</TabsContent><TabsContent value="password" className="pt-3">密码修改内容。</TabsContent><TabsContent value="notifications" className="pt-3">通知偏好内容。</TabsContent></Tabs>,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Line: Story = { render: (args) => <Tabs {...args} className="w-[28rem]"><TabsList variant="line"><TabsTrigger value="account">账户</TabsTrigger><TabsTrigger value="password">密码</TabsTrigger></TabsList><TabsContent value="account" className="pt-3">账户设置内容。</TabsContent><TabsContent value="password" className="pt-3">密码修改内容。</TabsContent></Tabs> };
export const Vertical: Story = { args: { orientation: "vertical" }, render: (args) => <Tabs {...args} className="w-[28rem]"><TabsList><TabsTrigger value="account">账户</TabsTrigger><TabsTrigger value="password">密码</TabsTrigger></TabsList><TabsContent value="account" className="p-3">账户设置内容。</TabsContent><TabsContent value="password" className="p-3">密码修改内容。</TabsContent></Tabs> };
export const DisabledTab: Story = { render: (args) => <Tabs {...args} className="w-[28rem]"><TabsList><TabsTrigger value="account">账户</TabsTrigger><TabsTrigger value="password" disabled>密码</TabsTrigger></TabsList><TabsContent value="account" className="pt-3">账户设置内容。</TabsContent></Tabs> };

