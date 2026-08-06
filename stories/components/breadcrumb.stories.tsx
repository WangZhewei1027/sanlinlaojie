import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Slash } from "lucide-react";
import { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

const meta = {
  title: "Design System/Components/Breadcrumb",
  component: Breadcrumb,
  parameters: { layout: "centered", docs: { description: { component: "展示当前位置的页面层级；末级使用 BreadcrumbPage。" } } },
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = { render: () => <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#">首页</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbLink href="#">管理后台</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>成员</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb> };
export const Collapsed: Story = { render: () => <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#">首页</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbEllipsis /></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>成员</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb> };
export const CustomSeparator: Story = { render: () => <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#">首页</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator><Slash /></BreadcrumbSeparator><BreadcrumbItem><BreadcrumbPage>资源</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb> };
export const LongLabels: Story = { render: () => <div className="max-w-sm"><Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#">Sanlin Old Street Administration</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Digital Heritage Assets</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb></div> };

