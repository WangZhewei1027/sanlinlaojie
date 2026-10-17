import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlacementTargetSelect } from "../../app/manage/content/PlacementTargetSelect";
import { noop } from "./fixtures";

const options = [
  { id: "v3", number: 3, createdAt: "2026-10-12T09:30:00Z" },
  { id: "v2", number: 2, createdAt: "2026-09-20T05:12:00Z" },
  { id: "v1", number: 1, createdAt: "2026-09-02T02:00:00Z" },
];

const meta = {
  title: "Manage/Content/Placement Target Select",
  component: PlacementTargetSelect,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-xs"><Story /></div>],
  args: { kind: "scene_revision", sourceName: "走马灯模型", options, value: "v3", onChange: noop },
} satisfies Meta<typeof PlacementTargetSelect>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LatestAssetVersion: Story = {};
export const OlderVersionPinned: Story = { args: { value: "v1" } };
export const SceneRevision: Story = { args: { kind: "scene_revision", sourceName: "夜游序章", value: "v2" } };
export const UnpublishedScene: Story = { args: { kind: "scene_revision", sourceName: "石桥传说", options: [], value: null } };
export const Disabled: Story = { args: { disabled: true } };
