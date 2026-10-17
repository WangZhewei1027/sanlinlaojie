import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetUsagePanel } from "../../app/manage/content/AssetUsagePanel";
import { noop, usage } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Usage Panel",
  component: AssetUsagePanel,
  parameters: { layout: "padded" },
  args: { usage, currentVersionNo: 3 },
} satisfies Meta<typeof AssetUsagePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const GroupedUsage: Story = {};
export const LimitedList: Story = { args: { usage: { ...usage, totalCount: 42 }, hasMore: true, onLoadMore: noop } };
export const CountOnlyRemainder: Story = { args: { usage: { ...usage, totalCount: 7, restrictedCount: 2 } } };
export const FilteredToVersion: Story = { args: { versionFilterNo: 2, usage: { totalCount: 2, restrictedCount: 0, entries: usage.entries.filter((entry) => entry.versionNo === 2) } } };
export const Unused: Story = { args: { usage: { totalCount: 0, restrictedCount: 0, entries: [] } } };
export const Loading: Story = { args: { status: "loading" } };
export const LoadError: Story = { args: { status: "error", onRetry: noop } };
