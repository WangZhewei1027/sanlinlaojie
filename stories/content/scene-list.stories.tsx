import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneList } from "../../app/manage/content/SceneList";
import { DEFAULT_SCENE_FILTERS } from "../../app/manage/content/types";
import { noop, ok, organizationName, projects, scenes } from "./fixtures";

const meta = {
  title: "Manage/Content/Scene List",
  component: SceneList,
  parameters: { layout: "padded", nextjs: { navigation: { pathname: "/manage/scenes" } } },
  args: {
    organizationName,
    project: projects.street,
    role: "editor",
    canEdit: true,
    filters: DEFAULT_SCENE_FILTERS,
    onFiltersChange: noop,
    status: "ready",
    scenes,
    getSceneHref: (id: string) => `/manage/scenes/${id}`,
    onCreate: ok,
    copyTargets: [projects.street, projects.festival, projects.school, projects.closed],
    onCopy: ok,
    onArchive: ok,
    onRestore: ok,
  },
} satisfies Meta<typeof SceneList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectScenes: Story = {};
export const WithJsonImport: Story = { args: { onImport: noop } };
export const Viewer: Story = { args: { role: "viewer", canEdit: false } };
export const ArchivedProject: Story = { args: { project: projects.closed, role: "manager" } };
export const NoProjectSelected: Story = { args: { project: null, role: null } };
export const Loading: Story = { args: { status: "loading", scenes: [] } };
export const LoadError: Story = { args: { status: "error", scenes: [], onRetry: noop } };
export const EmptyProject: Story = { args: { scenes: [] } };
export const NoMatches: Story = { args: { scenes: [], filters: { query: "灯", status: "published" } } };
export const RestoreFailed: Story = {
  args: { onRestore: async () => ({ ok: false, kind: "forbidden", message: "示例：恢复场景需要项目编辑权限。" }) },
};
export const Narrow: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
