import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContentNav } from "../../../app/manage/components/ContentNav";
const meta = {
  title: "Manage/Content Integration/Team Nav", component: ContentNav, parameters: { layout: "padded", nextjs: { navigation: { pathname: "/manage" } } },
  args: { organizationId: "org", showSettings: true },
} satisfies Meta<typeof ContentNav>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WorkbenchActive: Story = {};
export const AssetDetailUnderWorkbench: Story = { parameters: { nextjs: { navigation: { pathname: "/manage/assets/asset-lantern" } } } };
export const CollectionsActive: Story = { parameters: { nextjs: { navigation: { pathname: "/manage/collections/collection-street" } } } };
export const TeamSettingsActive: Story = { parameters: { nextjs: { navigation: { pathname: "/admin/members" } } } };
export const ViewerWithoutSettings: Story = { args: { showSettings: false } };
