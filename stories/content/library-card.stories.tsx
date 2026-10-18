import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MapPinned } from "lucide-react";
import { LibraryCard, LibraryGridSkeleton, LIBRARY_GRID } from "../../app/manage/content/LibraryCard";

const meta = {
  title: "Manage/Content/Library Card", component: LibraryCard,
  parameters: { layout: "padded" },
  render: (args) => <ul className={LIBRARY_GRID}><LibraryCard {...args} /></ul>,
  args: { name: "老街导览", href: "#", thumbnail: <span className="flex size-full items-center justify-center"><MapPinned className="size-8 text-muted-foreground" aria-hidden /></span>, metadata: <span>地图合集</span> },
} satisfies Meta<typeof LibraryCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SingleResult: Story = {};
export const OpensInNewTab: Story = { args: { target: "_blank" } };
export const Loading: Story = { render: () => <LibraryGridSkeleton label="正在加载" /> };
