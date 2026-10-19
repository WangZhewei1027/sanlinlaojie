"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  AuthButton,
  AuthDivider,
  AuthError,
  AuthFormShell,
  AuthInput,
  AuthLink,
} from "@/components/auth-form-shell";
import { AuthCodeForm } from "@/components/auth-code-form";
import { AuthPasswordFields } from "@/components/auth-password-fields";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/typography";

export interface SignUpFormViewProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "onSubmit"> {
  stage: "details" | "otp" | "created";
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
  onChangePhone: () => void;
  onGoogleSignIn: () => void;
  loginHref: string;
  isLoading?: boolean;
  isRedirecting?: boolean;
  isGoogleLoading?: boolean;
  error?: string | null;
  googleError?: string | null;
}

export function SignUpFormView({
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
  onChangePhone,
  onGoogleSignIn,
  loginHref,
  isLoading = false,
  isRedirecting = false,
  isGoogleLoading = false,
  error,
  googleError,
  ...props
}: SignUpFormViewProps) {
  const { t } = useTranslation();
  const busy = isLoading || isRedirecting || isGoogleLoading;
  return (
    <AuthFormShell
      {...props}
      title={t("auth.signUp")}
      description={
        stage === "otp"
          ? t("auth.phoneOtpSentMessage", { phone })
          : stage === "created"
            ? t("auth.errors.accountCreatedLoginFailed")
            : t("auth.signUpMethods")
      }
      footer={
        <>
          {t("auth.alreadyHaveAccount")}{" "}
          <AuthLink href={loginHref}>{t("auth.signIn")}</AuthLink>
        </>
      }
    >
      {stage === "created" ? (
        <AuthButton asChild>
          <Link href={loginHref}>{t("auth.backToLogin")}</Link>
        </AuthButton>
      ) : stage === "otp" ? (
        <AuthCodeForm
          code={code}
          onCodeChange={onCodeChange}
          onSubmit={onSubmit}
          onResend={onResend}
          onChangePhone={onChangePhone}
          busy={busy}
          error={error}
          submitLabel={
            isRedirecting
              ? t("auth.redirecting")
              : isLoading
                ? t("auth.verifyingCode")
                : t("auth.verifyAndSignUp")
          }
        />
      ) : (
        <form onSubmit={onSubmit}>
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="phone">{t("auth.phone")}</Label>
              <div className="flex gap-2">
                <AuthInput
                  value="+86"
                  aria-label={t("auth.countryCode")}
                  disabled
                  className="w-16 shrink-0 px-2 text-center"
                  tabIndex={-1}
                />
                <AuthInput
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="13800138000"
                  aria-describedby="phone-hint"
                  pattern="1[3-9][0-9]{9}"
                  required
                  value={phone}
                  onChange={(e) =>
                    onPhoneChange(e.target.value.replace(/\D/g, ""))
                  }
                  maxLength={11}
                />
              </div>
              <Text as="p" id="phone-hint" variant="bodySm" tone="subdued">
                {t("auth.chinaPhoneOnly")}
              </Text>
            </div>
            <AuthPasswordFields
              signUp
              password={password}
              confirmation={confirmation}
              onPasswordChange={onPasswordChange}
              onConfirmationChange={onConfirmationChange}
            />
            <AuthError>{error}</AuthError>
            <AuthButton type="submit" disabled={busy} aria-busy={isLoading}>
              {isLoading
                ? t("auth.sendingCode")
                : t("auth.sendVerificationCode")}
            </AuthButton>
          </fieldset>
        </form>
      )}
      {stage !== "created" && (
        <>
          <AuthDivider />
          <GoogleSignInButton
            onSignIn={onGoogleSignIn}
            isLoading={isGoogleLoading}
            disabled={isLoading || isRedirecting}
            error={googleError}
            className="h-auto min-h-12 rounded-full shadow-none"
          />
        </>
      )}
    </AuthFormShell>
  );
}
