import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TeamFrame } from "../../../app/manage/components/TeamFrame";
import { ContentWorkbench } from "../../../app/manage/content/ContentWorkbench";
import { CollectionList } from "../../../app/manage/content/CollectionList";
import { DEFAULT_WORKBENCH_FILTERS, type ContentLibraryKind, type WorkbenchView } from "../../../app/manage/content/types";
import libraryMeta from "../../content/content-workbench.stories";
import collectionMeta from "../../content/collection-list.stories";
import { archivedItems, workbenchItems } from "../../content/fixtures";

function LibraryPreview({ kind = "asset", empty = false, readOnly = false }: { kind?: ContentLibraryKind; empty?: boolean; readOnly?: boolean }) {
  const [filters, setFilters] = useState(DEFAULT_WORKBENCH_FILTERS);
  const [view, setView] = useState<WorkbenchView>("grid");
  const items = empty ? [] : [...workbenchItems, ...archivedItems].filter((item) =>
    item.kind === kind && item.state === filters.state &&
    (filters.type === "all" || item.type === filters.type) && item.name.includes(filters.query),
  );
  return <ContentWorkbench {...libraryMeta.args} kind={kind} items={items} totalCount={items.length} hasMore={false}
    canWrite={!readOnly} filters={filters} onFiltersChange={setFilters} view={view} onViewChange={setView} />;
}

const meta = {
  title: "Manage/Content Integration/Team Frame",
  component: TeamFrame,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true, navigation: { pathname: "/manage/assets" } } },
  decorators: [(Story) => <div className="-m-6"><Story /></div>],
  args: {
    organizationId: "example-team",
    teamName: "示例团队",
    showSettings: true,
    children: <LibraryPreview />,
  },
} satisfies Meta<typeof TeamFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Assets: Story = {};
export const Scenes: Story = {
  args: { children: <LibraryPreview kind="scene" /> },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/manage/scenes" } } },
};
export const MapCollections: Story = {
  args: { children: <CollectionList {...collectionMeta.args} /> },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/manage/collections" } } },
};
export const EmptyAssets: Story = { args: { children: <LibraryPreview empty /> } };
export const Viewer: Story = { args: { showSettings: false, children: <LibraryPreview readOnly /> } };
export const LongTeamName: Story = { args: { teamName: "示例团队：三林老街文化遗产与空间内容工作室" } };
export const English: Story = { globals: { language: "en" }, args: { teamName: "Example team" } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
