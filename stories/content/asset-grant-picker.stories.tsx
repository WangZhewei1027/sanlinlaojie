import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetGrantPicker } from "../../app/manage/content/AssetGrantPicker";
import { ok, projects } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Grant Picker",
  component: AssetGrantPicker,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-sm rounded-lg border"><Story /></div>],
  args: { projects: [projects.school, projects.closed], onGrant: ok },
} satisfies Meta<typeof AssetGrantPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ChooseProject: Story = {};
export const GrantForbidden: Story = { args: { onGrant: async () => ({ ok: false, kind: "forbidden", message: "示例：你不能访问目标项目。" }) } };
