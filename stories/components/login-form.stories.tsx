import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoginFormView } from "@/components/login-form-view";

const meta = {
  title: "Components/Login Form",
  component: LoginFormView,
  args: {
    account: "",
    password: "",
    onAccountChange: () => {},
    onPasswordChange: () => {},
    onLogin: (event) => event.preventDefault(),
    onGoogleSignIn: () => {},
    signUpHref: "/auth/sign-up?next=%2Fmanage",
  },
  render: function Render(args) {
    const [account, setAccount] = useState(args.account);
    const [password, setPassword] = useState(args.password);
    return (
      <LoginFormView
        {...args}
        account={account}
        password={password}
        onAccountChange={setAccount}
        onPasswordChange={setPassword}
      />
    );
  },
  decorators: [(Story) => <div className="mx-auto w-full max-w-md py-8"><Story /></div>],
  parameters: { layout: "padded" },
} satisfies Meta<typeof LoginFormView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const English: Story = { globals: { language: "en" } };
export const Mobile: Story = {
  decorators: [(Story) => <div className="mx-auto w-72 max-w-full"><Story /></div>],
};
export const Submitting: Story = { args: { account: "existing@example.com", isLoading: true } };
export const InvalidCredentials: Story = { args: { error: "账号或密码错误，请重新输入" } };
export const GoogleConnecting: Story = { args: { isGoogleLoading: true } };
export const GoogleUnavailable: Story = {
  args: { googleError: "Google 登录暂不可用，请使用手机号或稍后重试" },
};
