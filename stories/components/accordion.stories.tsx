import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const ITEMS = [
  { value: "about", title: "什么是三林老街 AR 项目？", content: "一个把 AR 内容放置到真实地理位置的文化项目。" },
  { value: "upload", title: "如何上传资源？", content: "在管理工作台选择地图位置，然后上传图片、音频或视频。" },
  { value: "types", title: "支持哪些文件类型？", content: "支持图片、视频、音频、文档、链接和文本。" },
];

const meta = {
  title: "Design System/Components/Accordion",
  component: Accordion,
  parameters: { layout: "centered", docs: { description: { component: "按需展开内容。默认单选模式适合常见 FAQ。" } } },
  args: { type: "single", collapsible: true },
  render: (args) => <Accordion {...args} className="w-[32rem] max-w-[calc(100vw-2rem)]">{ITEMS.map((item) => <AccordionItem key={item.value} value={item.value}><AccordionTrigger>{item.title}</AccordionTrigger><AccordionContent>{item.content}</AccordionContent></AccordionItem>)}</Accordion>,
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};
export const DefaultOpen: Story = { args: { defaultValue: "about" } };
export const Multiple: Story = { args: { type: "multiple", defaultValue: ["about", "upload"] } };
export const DisabledItem: Story = { render: (args) => <Accordion {...args} className="w-[32rem] max-w-[calc(100vw-2rem)]"><AccordionItem value="enabled"><AccordionTrigger>可用项目</AccordionTrigger><AccordionContent>可以正常展开。</AccordionContent></AccordionItem><AccordionItem value="disabled" disabled><AccordionTrigger>禁用项目</AccordionTrigger><AccordionContent>此内容不可展开。</AccordionContent></AccordionItem></Accordion> };
