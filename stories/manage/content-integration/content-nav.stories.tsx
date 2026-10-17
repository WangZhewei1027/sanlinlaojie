import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContentNav } from "../../../app/manage/components/ContentNav";
const meta = {
  title: "Manage/Content Integration/Section Nav", component: ContentNav, parameters: { layout: "padded", nextjs: { navigation: { pathname: "/manage/assets" } } },
  args: { organizationId: "org", workspaceId: "project" },
} satisfies Meta<typeof ContentNav>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AssetLibraryActive: Story = {};
export const ScenesActive: Story = { parameters: { nextjs: { navigation: { pathname: "/manage/scenes" } } } };
export const MapActive: Story = { parameters: { nextjs: { navigation: { pathname: "/manage" } } } };
