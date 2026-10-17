import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetLibraryToolbar } from "../../app/manage/content/AssetLibraryToolbar";
import { DEFAULT_ASSET_FILTERS } from "../../app/manage/content/types";
import { noop } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Library Toolbar",
  component: AssetLibraryToolbar,
  parameters: { layout: "padded" },
  args: { scope: "project", onScopeChange: noop, filters: DEFAULT_ASSET_FILTERS, onFiltersChange: noop, canUpload: true, onUpload: noop },
} satisfies Meta<typeof AssetLibraryToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const FiltersApplied: Story = { args: { scope: "organization", filters: { query: "灯", type: "model", state: "all", origin: "team_upload" } } };
export const UploadUnavailable: Story = { args: { canUpload: false, uploadUnavailableReason: "选择一个项目后才能上传" } };
export const Narrow: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
