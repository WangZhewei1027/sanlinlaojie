import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeChatQrButton } from "@/components/wechat-qr-button";
const meta = { title: "Components/WeChat QR Button", component: WeChatQrButton,
  args: { label: "微信扫码预览", title: "微信扫码预览场景", description: "展示最近保存的场景，AR 稳定 2 秒后出现在前方。", load: async (): Promise<{ url?: string; error?: string }> => ({ error: "二维码暂时不可用，请重试" }) },
  parameters: { layout: "centered" },
} satisfies Meta<typeof WeChatQrButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ErrorRetry: Story = {};
export const Loading: Story = { args: { load: () => new Promise(() => {}) } };
export const Unsaved: Story = { args: { description: "当前有未保存的修改，扫码展示上次保存的内容。" } };
