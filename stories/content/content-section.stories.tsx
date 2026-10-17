import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "../../components/ui/button";
import { Text } from "../../components/ui/typography";
import { ContentSection } from "../../app/manage/content/ContentSection";

const meta = {
  title: "Manage/Content/Section",
  component: ContentSection,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
  args: {
    title: "版本历史",
    description: "每处引用都固定在某个版本。",
    children: <Text as="p" variant="bodySm" className="px-4 py-3">示例内容区域</Text>,
  },
} satisfies Meta<typeof ContentSection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
export const WithSecondaryAction: Story = { args: { actions: <Button variant="ghost" size="sm">显示全部</Button> } };
