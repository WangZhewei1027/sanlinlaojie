import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneListToolbar } from "../../app/manage/content/SceneListToolbar";
import { DEFAULT_SCENE_FILTERS } from "../../app/manage/content/types";
import { noop } from "./fixtures";

const meta = {
  title: "Manage/Content/Scene List Toolbar",
  component: SceneListToolbar,
  parameters: { layout: "padded" },
  args: { filters: DEFAULT_SCENE_FILTERS, onFiltersChange: noop, canCreate: true, onCreate: noop },
} satisfies Meta<typeof SceneListToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const WithImport: Story = { args: { onImport: noop } };
export const CreateUnavailable: Story = { args: { canCreate: false, createUnavailableReason: "选择一个项目后才能新建场景" } };
export const Filtered: Story = { args: { filters: { query: "夜游", status: "changed" } } };
