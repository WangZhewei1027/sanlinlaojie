import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SignUpFormView } from "@/components/sign-up-form-view";

const meta = {
  title: "Components/Sign Up Form",
  component: SignUpFormView,
  args: {
    stage: "details",
    phone: "",
    password: "",
    confirmation: "",
    code: "",
    onPhoneChange: () => {},
    onPasswordChange: () => {},
    onConfirmationChange: () => {},
    onCodeChange: () => {},
    onSubmit: (event) => event.preventDefault(),
    onResend: () => {},
    onChangePhone: () => {},
    onGoogleSignIn: () => {},
    loginHref: "/auth/login",
  },
  render: function Render(args) {
    const [phone, setPhone] = useState(args.phone);
    const [password, setPassword] = useState(args.password);
    const [confirmation, setConfirmation] = useState(args.confirmation);
    const [code, setCode] = useState(args.code);
    return (
      <SignUpFormView
        {...args}
        phone={phone}
        password={password}
        confirmation={confirmation}
        code={code}
        onPhoneChange={setPhone}
        onPasswordChange={setPassword}
        onConfirmationChange={setConfirmation}
        onCodeChange={setCode}
      />
    );
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md py-8">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof SignUpFormView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const English: Story = { globals: { language: "en" } };
export const Mobile: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto w-72 max-w-full">
        <Story />
      </div>
    ),
  ],
};
export const SendingCode: Story = {
  args: { phone: "13800138000", isLoading: true },
};
export const InvalidPhone: Story = {
  args: { error: "仅支持中国大陆手机号，请检查后重试" },
};
export const SmsVerification: Story = {
  args: { stage: "otp", phone: "13800138000" },
};
export const Verifying: Story = {
  args: { stage: "otp", phone: "13800138000", code: "123456", isLoading: true },
};
export const ExpiredCode: Story = {
  args: {
    stage: "otp",
    phone: "13800138000",
    error: "验证码已过期，请重新发送",
  },
};
export const Redirecting: Story = {
  args: { stage: "otp", isLoading: true, isRedirecting: true },
};
export const AccountCreated: Story = { args: { stage: "created" } };
export const GoogleConnecting: Story = { args: { isGoogleLoading: true } };
export const GoogleUnavailable: Story = {
  args: { googleError: "Google 登录暂不可用，请使用手机号或稍后重试" },
};
