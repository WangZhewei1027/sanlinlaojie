import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContentNav } from "../../../app/manage/components/ContentNav";
const meta = {
  title: "Manage/Content Integration/Team Nav", component: ContentNav, parameters: { layout: "padded", nextjs: { appDirectory: true, navigation: { pathname: "/manage/assets" } } },
  decorators: [(Story) => <div className="w-56"><Story /></div>],
  args: { organizationId: "org", showSettings: true },
} satisfies Meta<typeof ContentNav>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AssetsActive: Story = {};
export const AssetDetailActive: Story = { parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/manage/assets/asset-lantern" } } } };
export const CollectionsActive: Story = { parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/manage/collections/collection-street" } } } };
export const TeamSettingsActive: Story = { parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/admin/members" } } } };
export const ViewerWithoutSettings: Story = { args: { showSettings: false } };

export const ScenesActive: Story = { parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/manage/scenes" } } } };
