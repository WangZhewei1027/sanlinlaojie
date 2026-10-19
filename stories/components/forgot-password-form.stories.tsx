import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ForgotPasswordFormView } from "@/components/forgot-password-form-view";

const meta = {
  title: "Components/Forgot Password Form",
  component: ForgotPasswordFormView,
  args: {
    stage: "input",
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
    onRestart: () => {},
  },
  render: function Render(args) {
    const [phone, setPhone] = useState(args.phone);
    const [password, setPassword] = useState(args.password);
    const [confirmation, setConfirmation] = useState(args.confirmation);
    const [code, setCode] = useState(args.code);
    return (
      <ForgotPasswordFormView
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
} satisfies Meta<typeof ForgotPasswordFormView>;
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
export const Sending: Story = {
  args: { phone: "13800138000", isLoading: true },
};
export const SmsVerification: Story = {
  args: { stage: "otp", phone: "13800138000" },
};
export const ExpiredTicket: Story = {
  args: {
    stage: "otp",
    phone: "13800138000",
    error: "验证凭证已过期，请重新获取验证码",
  },
};
export const NewPassword: Story = {
  args: { stage: "newPassword" },
};
export const PasswordMismatch: Story = {
  args: { stage: "newPassword", error: "两次输入的密码不一致" },
};
export const PhoneResetSuccess: Story = {
  args: { stage: "success" },
};

export const InvalidPhone: Story = {
  args: {
    phone: "12345",
    error: "仅支持中国大陆手机号，请输入有效的 11 位手机号码",
  },
};
