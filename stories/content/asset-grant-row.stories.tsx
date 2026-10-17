import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetGrantRow } from "../../app/manage/content/AssetGrantRow";
import { grants, ok } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Grant Row",
  component: AssetGrantRow,
  parameters: { layout: "padded" },
  decorators: [(Story) => <ul className="max-w-sm rounded-lg border px-4"><Story /></ul>],
  args: { grant: grants[2], canRevoke: true, onRevoke: ok },
} satisfies Meta<typeof AssetGrantRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Revocable: Story = {};
export const BlockedByReferences: Story = { args: { grant: grants[1] } };
export const OriginProject: Story = { args: { grant: grants[0] } };
export const ArchivedProject: Story = { args: { grant: { ...grants[2], archived: true } } };
export const ViewOnly: Story = { args: { canRevoke: false } };
