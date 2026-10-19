import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeChatQrSettings } from "@/app/admin/settings/components/WeChatQrSettings";

const meta = {
  title: "Components/WeChat QR Settings",
  component: WeChatQrSettings,
  args: { environment: "release", onEnvironmentChange: () => {} },
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
  render: function Settings(args) {
    const [environment, setEnvironment] = useState(args.environment);
    return <WeChatQrSettings {...args} environment={environment} onEnvironmentChange={setEnvironment} />;
  },
} satisfies Meta<typeof WeChatQrSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Release: Story = {};
export const Trial: Story = { args: { environment: "trial" } };
export const Development: Story = { args: { environment: "develop" } };
