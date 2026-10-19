import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

const meta = {
  title: "Components/Google Sign In Button",
  component: GoogleSignInButton,
  args: { onSignIn: () => {} },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
  parameters: { layout: "centered" },
} satisfies Meta<typeof GoogleSignInButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LoginPill: Story = {
  args: { className: "min-h-12 rounded-full shadow-none" },
};
export const Connecting: Story = { args: { isLoading: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Unavailable: Story = {
  args: { error: "Google 登录暂不可用，请使用手机号或稍后重试" },
};
