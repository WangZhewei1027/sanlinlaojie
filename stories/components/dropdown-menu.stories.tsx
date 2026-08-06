import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const meta = {
  title: "Design System/Components/Dropdown Menu",
  component: DropdownMenu,
  parameters: { layout: "centered", docs: { description: { component: "收纳次要操作与选择项；触发入口必须始终可见。" } } },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

function Trigger() { return <DropdownMenuTrigger asChild><Button variant="outline">打开菜单</Button></DropdownMenuTrigger>; }

export const Basic: Story = { render: () => <DropdownMenu><Trigger /><DropdownMenuContent className="w-56"><DropdownMenuLabel>我的账户</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem>个人资料<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut></DropdownMenuItem><DropdownMenuItem>设置</DropdownMenuItem><DropdownMenuItem disabled>无权限操作</DropdownMenuItem></DropdownMenuContent></DropdownMenu> };
export const CheckboxItems: Story = { render: () => <DropdownMenu><Trigger /><DropdownMenuContent className="w-56"><DropdownMenuLabel>显示内容</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuCheckboxItem checked>状态栏</DropdownMenuCheckboxItem><DropdownMenuCheckboxItem>坐标</DropdownMenuCheckboxItem></DropdownMenuContent></DropdownMenu> };
export const RadioItems: Story = { render: () => <DropdownMenu><Trigger /><DropdownMenuContent className="w-56"><DropdownMenuLabel>语言</DropdownMenuLabel><DropdownMenuRadioGroup value="zh"><DropdownMenuRadioItem value="zh">中文</DropdownMenuRadioItem><DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu> };
export const Submenu: Story = { render: () => <DropdownMenu><Trigger /><DropdownMenuContent><DropdownMenuItem>编辑</DropdownMenuItem><DropdownMenuSub><DropdownMenuSubTrigger>移动到</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem>历史影像</DropdownMenuItem><DropdownMenuItem>口述档案</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub></DropdownMenuContent></DropdownMenu> };
export const DestructiveAction: Story = { render: () => <DropdownMenu><Trigger /><DropdownMenuContent><DropdownMenuItem>编辑</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive">删除资源</DropdownMenuItem></DropdownMenuContent></DropdownMenu> };

