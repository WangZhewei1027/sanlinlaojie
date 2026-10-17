import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorkbenchCard } from "../../app/manage/content/WorkbenchCard";
import { archivedItems, noop, workbenchItems } from "./fixtures";

const byId = (id: string) => [...workbenchItems, ...archivedItems].find((item) => item.id === id)!;

const meta = {
  title: "Manage/Content/Workbench Card",
  component: WorkbenchCard,
  parameters: { layout: "centered" },
  decorators: [(Story) => <ul className="w-56"><Story /></ul>],
  args: { item: byId("asset-bridge"), href: "#", actions: { onCopy: noop, onArchive: noop, onRestore: noop } },
} satisfies Meta<typeof WorkbenchCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ImageAsset: Story = {};
export const ModelWithoutSnapshot: Story = { args: { item: byId("asset-lantern") } };
export const TextAsset: Story = { args: { item: byId("asset-story") } };
export const PublishedScene: Story = { args: { item: byId("scene-gate") } };
export const SceneWithUnpublishedChanges: Story = { args: { item: byId("scene-intro") } };
export const UnpublishedSceneViewer: Story = { args: { item: byId("scene-draft"), actions: {} } };
export const MissingFileLongName: Story = { args: { item: byId("asset-dragon") } };
export const ArchivedScene: Story = { args: { item: byId("scene-old") } };
