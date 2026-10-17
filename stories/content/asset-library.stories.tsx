import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetLibrary } from "../../app/manage/content/AssetLibrary";
import { DEFAULT_ASSET_FILTERS } from "../../app/manage/content/types";
import { libraryItems, noop, ok, organizationItems, organizationName, projects } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Library",
  component: AssetLibrary,
  parameters: { layout: "padded", nextjs: { navigation: { pathname: "/manage/assets" } } },
  args: {
    organizationName,
    project: projects.street,
    role: "editor",
    scope: "project",
    onScopeChange: noop,
    filters: DEFAULT_ASSET_FILTERS,
    onFiltersChange: noop,
    status: "ready",
    items: libraryItems,
    totalCount: 24,
    hasMore: true,
    onLoadMore: noop,
    canUpload: true,
    onUpload: noop,
    canAddToProject: true,
    onAddToProject: ok,
    getAssetHref: (id: string) => `/manage/assets/${id}`,
  },
} satisfies Meta<typeof AssetLibrary>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectAssets: Story = {};
export const OrganizationShared: Story = { args: { scope: "organization", items: organizationItems, totalCount: organizationItems.length, hasMore: false } };
export const AddToProjectFailed: Story = {
  args: {
    scope: "organization",
    items: organizationItems,
    onAddToProject: async () => ({ ok: false, kind: "forbidden", message: "示例：只有项目编辑者可以把共享素材加入项目。" }),
  },
};
export const Loading: Story = { args: { status: "loading", items: [] } };
export const LoadError: Story = { args: { status: "error", items: [], onRetry: noop } };
export const EmptyProject: Story = { args: { items: [], totalCount: 0, hasMore: false } };
export const EmptyShared: Story = { args: { scope: "organization", items: [], totalCount: 0, hasMore: false } };
export const NoMatches: Story = { args: { items: [], hasMore: false, filters: { ...DEFAULT_ASSET_FILTERS, query: "不存在的名称", type: "video" } } };
export const NoProjectSelected: Story = { args: { project: null, role: null, items: [], hasMore: false } };
export const ViewerReadOnly: Story = { args: { role: "viewer", canUpload: false, canAddToProject: false } };
export const ArchivedProject: Story = { args: { project: projects.closed } };
export const Narrow: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
