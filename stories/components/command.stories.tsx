import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Building2, Check, FileText, Image as ImageIcon, Pin } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";

const meta = {
  title: "Design System/Components/Command",
  component: Command,
  parameters: { layout: "centered", docs: { description: { component: "带即时筛选的命令列表，适合搜索、切换与快捷操作。" } } },
  decorators: [(Story) => <div className="w-80 rounded-lg border"><Story /></div>],
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OrganizationPicker: Story = { render: () => <Command><CommandInput placeholder="搜索组织" /><CommandList><CommandEmpty>未找到组织</CommandEmpty><CommandGroup heading="已置顶"><CommandItem><Building2 /><span className="min-w-0 flex-1 truncate">三林老街</span><Check className="text-primary" /><Pin className="text-primary" /></CommandItem></CommandGroup><CommandSeparator /><CommandGroup heading="组织列表"><CommandItem><Building2 />测试组织</CommandItem><CommandItem><Building2 /><span className="truncate">A very long organization name for overflow</span></CommandItem></CommandGroup></CommandList></Command> };
export const ActionMenu: Story = { render: () => <Command><CommandInput placeholder="搜索操作" /><CommandList><CommandEmpty>未找到操作</CommandEmpty><CommandGroup heading="创建"><CommandItem><ImageIcon />上传图片<CommandShortcut>⌘I</CommandShortcut></CommandItem><CommandItem><FileText />新建文本<CommandShortcut>⌘T</CommandShortcut></CommandItem></CommandGroup></CommandList></Command> };
export const Empty: Story = { render: () => <Command><CommandInput defaultValue="不存在的项目" /><CommandList><CommandEmpty>未找到结果</CommandEmpty><CommandItem>三林老街</CommandItem></CommandList></Command> };
export const DisabledItem: Story = { render: () => <Command><CommandList><CommandGroup heading="操作"><CommandItem>可用操作</CommandItem><CommandItem disabled>无权限操作</CommandItem></CommandGroup></CommandList></Command> };
