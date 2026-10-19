"use client";

import { authClient } from "@/lib/auth/client";
import { safeNext } from "@/lib/safe-next";
import { formatAuthError } from "@/lib/auth/auth-error";
import { PHONE_EMAIL_DOMAIN } from "@/lib/phone-email";
import { normalizeChinaPhone } from "@/lib/auth/china-phone";
import { useGoogleSignIn } from "@/lib/auth/use-google-sign-in";
import { LoginFormView } from "@/components/login-form-view";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const { t } = useTranslation();
  const google = useGoogleSignIn(next);
  const busy = isLoading || google.isLoading;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmedAccount = account.trim();
    const phone = normalizeChinaPhone(account);
    if (!trimmedAccount.includes("@") && !phone) {
      setError(t("auth.errors.invalidPhone"));
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await authClient.signIn.email({
        email: phone ? `${phone}@${PHONE_EMAIL_DOMAIN}` : trimmedAccount,
        password,
      });
      if (error) throw error;
      // 登录成功：保持按钮禁用并提示跳转中，避免用户误以为无响应
      setIsRedirecting(true);
      // Force full refresh so server components reload with new auth state
      router.refresh();
      router.push(next);
    } catch (error: unknown) {
      setError(formatAuthError(t, error));
      setIsLoading(false);
    }
  };

  return (
    <LoginFormView
      {...props}
      className={className}
      account={account}
      password={password}
      onAccountChange={setAccount}
      onPasswordChange={setPassword}
      onLogin={handleLogin}
      onGoogleSignIn={google.signIn}
      isLoading={isLoading}
      isRedirecting={isRedirecting}
      isGoogleLoading={google.isLoading}
      error={error}
      googleError={
        google.error ??
        (searchParams.get("error") ? t("auth.errors.googleFailed") : null)
      }
      signUpHref={
        next !== "/" ? `/auth/sign-up?next=${encodeURIComponent(next)}` : "/auth/sign-up"
      }
    />
  );
}
