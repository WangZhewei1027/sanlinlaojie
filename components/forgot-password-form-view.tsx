"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  AuthButton,
  AuthError,
  AuthFormShell,
  AuthInput,
  AuthLink,
} from "@/components/auth-form-shell";
import { AuthCodeForm } from "@/components/auth-code-form";
import { AuthPasswordFields } from "@/components/auth-password-fields";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/typography";

export interface ForgotPasswordFormViewProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "onSubmit"> {
  stage: "input" | "otp" | "newPassword" | "success";
  phone: string;
  password: string;
  confirmation: string;
  code: string;
  onPhoneChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onResend: () => void;
  onRestart: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ForgotPasswordFormView({
  stage,
  phone,
  password,
  confirmation,
  code,
  onPhoneChange,
  onPasswordChange,
  onConfirmationChange,
  onCodeChange,
  onSubmit,
  onResend,
  onRestart,
  isLoading = false,
  error,
  ...props
}: ForgotPasswordFormViewProps) {
  const { t } = useTranslation();
  const complete = stage === "success";
  const description =
    stage === "otp"
      ? t("auth.phoneOtpSentMessage", { phone: phone.trim() })
      : stage === "newPassword"
        ? t("auth.enterNewPassword")
        : stage === "success"
          ? t("auth.passwordResetSuccess")
          : t("auth.enterPhoneToReset");
  return (
    <AuthFormShell
      {...props}
      title={t("auth.resetPassword")}
      description={description}
      footer={
        !complete && (
          <AuthLink href="/auth/login">{t("auth.backToLogin")}</AuthLink>
        )
      }
    >
      {complete ? (
        <AuthButton asChild>
          <Link href="/auth/login">{t("auth.backToLogin")}</Link>
        </AuthButton>
      ) : stage === "otp" ? (
        <AuthCodeForm
          code={code}
          onCodeChange={onCodeChange}
          onSubmit={onSubmit}
          onResend={onResend}
          onChangePhone={onRestart}
          busy={isLoading}
          error={error}
          submitLabel={t(
            isLoading ? "auth.verifyingCode" : "auth.verifyAndResetPassword",
          )}
        />
      ) : (
        <form onSubmit={onSubmit}>
          <fieldset
            disabled={isLoading}
            className="flex min-w-0 flex-col gap-6"
          >
            {stage === "newPassword" ? (
              <AuthPasswordFields
                password={password}
                confirmation={confirmation}
                onPasswordChange={onPasswordChange}
                onConfirmationChange={onConfirmationChange}
                autoFocus
              />
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="reset-phone">{t("auth.phone")}</Label>
                <div className="flex gap-2">
                  <AuthInput
                    value="+86"
                    aria-label={t("auth.countryCode")}
                    disabled
                    className="w-16 shrink-0 px-2 text-center"
                    tabIndex={-1}
                  />
                  <AuthInput
                    id="reset-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="13800138000"
                    aria-describedby="reset-phone-hint"
                    pattern="1[3-9][0-9]{9}"
                    maxLength={11}
                    required
                    value={phone}
                    onChange={(e) =>
                      onPhoneChange(e.target.value.replace(/\D/g, ""))
                    }
                  />
                </div>
                <Text
                  as="p"
                  id="reset-phone-hint"
                  variant="bodySm"
                  tone="subdued"
                >
                  {t("auth.chinaPhoneOnly")}
                </Text>
              </div>
            )}
            <AuthError>{error}</AuthError>
            <AuthButton
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {t(
                isLoading
                  ? "common.loading"
                  : stage === "newPassword"
                    ? "auth.resetPassword"
                    : "auth.sendVerificationCode",
              )}
            </AuthButton>
          </fieldset>
        </form>
      )}
    </AuthFormShell>
  );
}
