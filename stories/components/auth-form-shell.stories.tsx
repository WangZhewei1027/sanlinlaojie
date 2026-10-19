import Link from "next/link";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useTranslation } from "react-i18next";
import {
  AuthButton,
  AuthDivider,
  AuthError,
  AuthFormShell,
  AuthInput,
  AuthLink,
} from "@/components/auth-form-shell";
import { AuthPasswordInput } from "@/components/auth-password-input";
import { AuthPasswordFields } from "@/components/auth-password-fields";
import { AuthCodeForm } from "@/components/auth-code-form";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/typography";

const meta = {
  title: "Components/Auth Form Shell",
  component: AuthFormShell,
  args: { title: "欢迎回来", description: "使用邮箱或手机号继续" },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md py-8">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof AuthFormShell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Controls: Story = {
  render: (args) => (
    <AuthFormShell
      {...args}
      footer={<AuthLink href="/auth/login">返回登录</AuthLink>}
    >
      <div className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="example-account">邮箱 / 手机号</Label>
          <AuthInput
            id="example-account"
            placeholder="m@example.com / 13800138000"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="example-password">密码</Label>
          <AuthPasswordInput
            id="example-password"
            autoComplete="current-password"
          />
        </div>
        <AuthError>账号或密码错误，请重新输入</AuthError>
        <AuthButton>登录</AuthButton>
      </div>
      <AuthDivider />
      <AuthButton variant="outline">其他方式</AuthButton>
    </AuthFormShell>
  ),
};
export const DisabledPasswords: Story = {
  render: (args) => (
    <AuthFormShell {...args}>
      <fieldset disabled className="space-y-6">
        <AuthPasswordFields
          password=""
          confirmation=""
          onPasswordChange={() => {}}
          onConfirmationChange={() => {}}
        />
        <AuthButton disabled aria-busy>
          保存中...
        </AuthButton>
      </fieldset>
    </AuthFormShell>
  ),
};
export const Verification: Story = {
  render: (args) => (
    <AuthFormShell {...args}>
      <AuthCodeForm
        code=""
        onCodeChange={() => {}}
        onSubmit={(event) => event.preventDefault()}
        onResend={() => {}}
        onChangePhone={() => {}}
        submitLabel="验证并注册"
      />
    </AuthFormShell>
  ),
};
export const LegacyEmailConfirmation: Story = {
  render: function Render() {
    const { t } = useTranslation();
    return (
      <AuthFormShell
        title={t("auth.signUpSuccessTitle")}
        description={t("auth.signUpSuccessDescription")}
      >
        <div className="space-y-6">
          <Text as="p" variant="bodySm" tone="subdued">
            {t("auth.signUpSuccessDetail")}
          </Text>
          <AuthButton asChild>
            <Link href="/auth/login">{t("auth.backToLogin")}</Link>
          </AuthButton>
        </div>
      </AuthFormShell>
    );
  },
};
export const LongError: Story = {
  args: { title: "出错了", description: "ERROR_".repeat(30) },
  render: (args) => (
    <AuthFormShell {...args}>
      <AuthButton asChild>
        <a href="/auth/login">返回登录</a>
      </AuthButton>
    </AuthFormShell>
  ),
};
