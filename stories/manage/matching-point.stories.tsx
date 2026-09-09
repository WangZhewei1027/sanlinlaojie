import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MatchingPointPanel } from "../../app/manage/components/AssetEditor/MatchingPointPanel";
const noop = () => {};
const referencePhoto = new URL(
  "../../public/images/landing/street.webp",
  import.meta.url,
).href;
const meta = {
  title: "Manage/Matching Point",
  component: MatchingPointPanel,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    imageUrl: null,
    imageFile: null,
    isEditing: false,
    status: "missing_image",
    canManage: true,
    childrenAssets: [],
    availableAssets: [],
    onImageSelect: noop,
    onImageRemove: noop,
    onRebuild: noop,
    onRefresh: noop,
    onAttach: noop,
    onDetach: noop,
  },
} satisfies Meta<typeof MatchingPointPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MissingImage: Story = {};
export const AddReference: Story = { args: { isEditing: true } };
export const ReadyWithAssets: Story = {
  args: {
    status: "ready",
    updatedAt: "2026-09-09T02:30:00Z",
    imageUrl: referencePhoto,
    childrenAssets: [
      { id: "a", name: "老街入口介绍" },
      {
        id: "b",
        name: "sanlin-street-corner-building-model-reference-20260908-final.glb",
      },
    ],
    availableAssets: [{ id: "c", name: "沿街店面历史照片" }],
  },
};
export const ServiceUnconfigured: Story = { args: { status: "unconfigured" } };
export const GeneratingFeatures: Story = { args: { status: "processing", imageUrl: referencePhoto } };
export const Failed: Story = {
  args: { status: "failed", imageUrl: referencePhoto, statusError: "匹配服务暂不可用，请稍后重试" },
};
export const ReadOnly: Story = {
  args: {
    status: "ready",
    canManage: false,
    childrenAssets: [{ id: "a", name: "老街入口介绍" }],
  },
};

export const PendingFeatures: Story = { args: { status: "pending", imageUrl: referencePhoto } };
export const CheckingStatus: Story = { args: { status: "loading", imageUrl: referencePhoto } };
export const StatusUnavailable: Story = { args: { status: "status_error", imageUrl: referencePhoto, statusError: "请求超时，请刷新状态" } };
export const SavingReference: Story = { args: { status: "saving", isEditing: true, imageUrl: referencePhoto } };
export const UnsavedReference: Story = { args: { status: "unsaved", isEditing: true, imageUrl: referencePhoto } };
