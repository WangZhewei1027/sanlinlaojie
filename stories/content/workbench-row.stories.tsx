import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorkbenchRow } from "../../app/manage/content/WorkbenchRow";
import { noop, workbenchItems } from "./fixtures";

const meta = {
  title: "Manage/Content/Workbench Row",
  component: WorkbenchRow,
  parameters: { layout: "padded" },
  decorators: [(Story) => <ul className="divide-y rounded-lg border"><Story /></ul>],
  args: { item: workbenchItems[0], href: "#", actions: { onCopy: noop, onArchive: noop, onRestore: noop } },
} satisfies Meta<typeof WorkbenchRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SceneRow: Story = {};
export const ImageRow: Story = { args: { item: workbenchItems[1] } };
export const MissingFile: Story = { args: { item: workbenchItems[9] } };
export const Narrow: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
