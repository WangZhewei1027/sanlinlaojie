import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContentFeatureState } from "../../../app/manage/components/ContentFeatureState";
const meta = {
  title: "Manage/Content Integration/Feature State", component: ContentFeatureState, parameters: { layout: "padded" },
  args: { state: "legacy", mapHref: "/manage" },
} satisfies Meta<typeof ContentFeatureState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LegacyOrganization: Story = {};
export const Preparing: Story = { args: { state: "preparing" } };
export const ReadOnlyCutover: Story = { args: { state: "readonly" } };
export const NoOrganization: Story = { args: { state: "no-organization" } };
export const StateUnavailable: Story = { args: { state: "error", error: "HTTP 500", onRetry: () => {} } };
