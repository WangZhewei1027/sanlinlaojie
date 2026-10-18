import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CollectionList } from "../../app/manage/content/CollectionList";
import { archivedCollections, collections, noop, ok, team, viewerTeam } from "./fixtures";

const readOnly = (items: typeof collections) => items.map((item) => ({ ...item, canEdit: false, canArchive: false }));

const meta = {
  title: "Manage/Content/Collection List",
  component: CollectionList,
  parameters: { layout: "padded", nextjs: { navigation: { pathname: "/manage/collections" } } },
  decorators: [(Story) => <div className="mx-auto max-w-6xl"><Story /></div>],
  args: {
    team,
    state: "active",
    onStateChange: noop,
    status: "ready",
    collections,
    getHref: (id: string) => `/manage/collections/${id}`,
    canCreate: true,
    onCreate: ok,
    onEdit: ok,
    onArchive: ok,
    onRestore: ok,
  },
} satisfies Meta<typeof CollectionList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MapCollections: Story = {};
export const ManyCollections: Story = { args: { collections: Array.from({ length: 12 }, (_, index) => ({ ...collections[index % collections.length], id: `collection-example-${index}`, name: `${collections[index % collections.length].name} ${index + 1}` })) } };
export const SingleCollection: Story = { args: { collections: collections.slice(0, 1) } };
export const ArchivedCollections: Story = { args: { state: "archived", collections: archivedCollections } };
export const ViewerReadOnly: Story = {
  args: { team: viewerTeam, canCreate: false, readOnlyReason: "你是团队查看者：可以浏览和预览，不能上传或编辑。", collections: readOnly(collections) },
};
export const Loading: Story = { args: { status: "loading", collections: [] } };
export const LoadError: Story = { args: { status: "error", collections: [], errorMessage: "示例：合集服务暂时不可用。", onRetry: noop } };
export const Empty: Story = { args: { collections: [] } };
export const EmptyViewer: Story = { args: { collections: [], canCreate: false, team: viewerTeam, readOnlyReason: "你是团队查看者：可以浏览和预览，不能上传或编辑。" } };
export const NoArchived: Story = { args: { state: "archived", collections: [] } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
