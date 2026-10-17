import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorkbenchToolbar } from "../../app/manage/content/WorkbenchToolbar";
import { DEFAULT_WORKBENCH_FILTERS } from "../../app/manage/content/types";
import { noop } from "./fixtures";

const meta = {
  title: "Manage/Content/Workbench Toolbar",
  component: WorkbenchToolbar,
  parameters: { layout: "padded" },
  args: { filters: DEFAULT_WORKBENCH_FILTERS, onFiltersChange: noop, view: "grid", onViewChange: noop },
} satisfies Meta<typeof WorkbenchToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SearchingModels: Story = { args: { filters: { ...DEFAULT_WORKBENCH_FILTERS, query: "灯", type: "model" } } };
export const ArchivedList: Story = { args: { filters: { ...DEFAULT_WORKBENCH_FILTERS, state: "archived" }, view: "list" } };
export const Narrow: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
