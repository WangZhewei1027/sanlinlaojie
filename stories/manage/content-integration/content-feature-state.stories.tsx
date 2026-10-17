import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContentFeatureState } from "../../../app/manage/components/ContentFeatureState";
const meta = { title: "Manage/Content Integration/Feature State", component: ContentFeatureState, parameters: { layout: "padded" }, args: { state: "no-organization" } } satisfies Meta<typeof ContentFeatureState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NoTeam: Story = {};
export const LoadFailed: Story = { args: { state: "error", error: "HTTP 500", onRetry: () => {} } };
