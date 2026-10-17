import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContentNotice } from "../../app/manage/content/ContentFeedback";
import { ContentWorkbench } from "../../app/manage/content/ContentWorkbench";
import { DEFAULT_WORKBENCH_FILTERS } from "../../app/manage/content/types";
import { archivedItems, noop, ok, team, viewerTeam, workbenchItems } from "./fixtures";

const meta = {
  title: "Manage/Content/Workbench",
  component: ContentWorkbench,
  parameters: { layout: "padded", nextjs: { navigation: { pathname: "/manage" } } },
  decorators: [(Story) => <div className="mx-auto max-w-6xl"><Story /></div>],
  args: {
    team,
    filters: DEFAULT_WORKBENCH_FILTERS,
    onFiltersChange: noop,
    view: "grid",
    onViewChange: noop,
    status: "ready",
    items: workbenchItems,
    totalCount: 26,
    hasMore: true,
    onLoadMore: noop,
    getItemHref: (item) => `/manage/${item.kind === "scene" ? "scenes" : "assets"}/${item.id}`,
    canWrite: true,
    canUpload: true,
    onUpload: noop,
    onCreateScene: ok,
    onImportScene: noop,
    onCopyScene: ok,
    onArchiveScene: ok,
    onRestoreScene: ok,
  },
} satisfies Meta<typeof ContentWorkbench>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllContentGrid: Story = {};
export const ListView: Story = { args: { view: "list" } };
export const ScenesFilter: Story = {
  args: { filters: { ...DEFAULT_WORKBENCH_FILTERS, type: "scene" }, items: workbenchItems.filter((item) => item.kind === "scene"), totalCount: 3, hasMore: false },
};
export const ImagesFilter: Story = {
  args: { filters: { ...DEFAULT_WORKBENCH_FILTERS, type: "image" }, items: workbenchItems.filter((item) => item.type === "image"), totalCount: 2, hasMore: false },
};
export const Archived: Story = { args: { filters: { ...DEFAULT_WORKBENCH_FILTERS, state: "archived" }, items: archivedItems, totalCount: 2, hasMore: false } };
export const ViewerReadOnly: Story = {
  args: { team: viewerTeam, canWrite: false, readOnlyReason: "你是团队查看者：可以浏览和预览，不能上传或编辑。", hasMore: false },
};
export const MigrationArchivedTeam: Story = {
  args: {
    canWrite: false,
    readOnlyReason: "团队已归档，内容只读。",
    notice: <ContentNotice tone="warning" title="团队已归档" description="恢复团队后即可继续编辑。" />,
  },
};
export const Loading: Story = { args: { status: "loading", items: [] } };
export const LoadingList: Story = { args: { status: "loading", items: [], view: "list" } };
export const LoadError: Story = { args: { status: "error", items: [], errorMessage: "示例：网络错误，请稍后重试。", onRetry: noop } };
export const EmptyTeam: Story = { args: { items: [], totalCount: 0, hasMore: false } };
export const EmptyTeamViewer: Story = { args: { items: [], totalCount: 0, hasMore: false, team: viewerTeam, canWrite: false, readOnlyReason: "你是团队查看者：可以浏览和预览，不能上传或编辑。" } };
export const NoScenesYet: Story = { args: { items: [], hasMore: false, filters: { ...DEFAULT_WORKBENCH_FILTERS, type: "scene" } } };
export const NoMatches: Story = { args: { items: [], hasMore: false, filters: { ...DEFAULT_WORKBENCH_FILTERS, query: "不存在的名字" } } };
export const RestoreFailed: Story = {
  args: {
    filters: { ...DEFAULT_WORKBENCH_FILTERS, state: "archived" },
    items: archivedItems,
    hasMore: false,
    onRestoreScene: async () => ({ ok: false, kind: "conflict", message: "示例：场景已被他人修改，请刷新后再试。" }),
  },
  parameters: { docs: { description: { story: "Restore the archived scene from its menu to see the failure notice." } } },
};
export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
export const MobileList: Story = { args: { view: "list" }, parameters: { viewport: { defaultViewport: "mobile1" } } };
