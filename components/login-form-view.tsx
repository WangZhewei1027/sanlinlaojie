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
import { AuthPasswordInput } from "@/components/auth-password-input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/typography";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export interface LoginFormViewProps
  extends React.ComponentPropsWithoutRef<"div"> {
  account: string;
  password: string;
  onAccountChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: React.FormEventHandler<HTMLFormElement>;
  onGoogleSignIn: () => void;
  signUpHref: string;
  isLoading?: boolean;
  isRedirecting?: boolean;
  isGoogleLoading?: boolean;
  error?: string | null;
  googleError?: string | null;
}

export function LoginFormView({
  account,
  password,
  onAccountChange,
  onPasswordChange,
  onLogin,
  onGoogleSignIn,
  signUpHref,
  isLoading = false,
  isRedirecting = false,
  isGoogleLoading = false,
  error,
  googleError,
  className,
  ...props
}: LoginFormViewProps) {
  const { t } = useTranslation();
  const busy = isLoading || isGoogleLoading || isRedirecting;

  return (
    <AuthFormShell
      {...props}
      className={className}
      title={t("auth.welcomeBack")}
      description={t("auth.enterEmailOrPhone")}
      footer={
        <>
          {t("auth.dontHaveAccount")}{" "}
          <AuthLink href={signUpHref}>{t("auth.signUp")}</AuthLink>
        </>
      }
    >
      <form onSubmit={onLogin}>
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="account">{t("auth.emailOrPhone")}</Label>
            <AuthInput
              id="account"
              type="text"
              autoComplete="username"
              placeholder="m@example.com / 13800138000"
              aria-describedby="account-hint"
              required
              value={account}
              onChange={(e) => onAccountChange(e.target.value)}
            />
            <Text as="p" id="account-hint" variant="bodySm" tone="subdued">
              {t("auth.chinaPhoneOnly")}
            </Text>
          </div>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Link
                href="/auth/forgot-password"
                className="rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t("auth.forgotPassword")}
              </Link>
            </div>
            <AuthPasswordInput
              id="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </div>
          <AuthError>{error}</AuthError>
          <AuthButton type="submit" disabled={busy} aria-busy={isLoading}>
            {isRedirecting
              ? t("auth.redirecting")
              : isLoading
                ? t("auth.loggingIn")
                : t("auth.signIn")}
          </AuthButton>
        </fieldset>
      </form>

      <AuthDivider />
      <GoogleSignInButton
        onSignIn={onGoogleSignIn}
        isLoading={isGoogleLoading}
        disabled={isLoading || isRedirecting}
        error={googleError}
        className="h-auto min-h-12 rounded-full shadow-none"
      />
    </AuthFormShell>
  );
}
