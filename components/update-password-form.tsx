"use client";

import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth/client";
import { setOwnPassword } from "@/lib/auth/password.server";
import { formatAuthError, formatServerAuthError } from "@/lib/auth/auth-error";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// 两种进入方式：
// 1. 邮件重置链接：Better Auth 校验后跳到 ?token=…（失效则 ?error=INVALID_TOKEN），
//    凭 token 调 resetPassword，完成后未登录，回登录页
// 2. 已登录用户直接访问（无 token）：走 server action 直接改密码，完成后回首页
export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");
  const { t } = useTranslation();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError(t("auth.passwordsMustMatch"));
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      setIsLoading(false);
      return;
    }

    // 链接已失效：提示重新发送重置邮件
    if (!token && linkError) {
      setError(t("auth.errors.resetLinkInvalid"));
      setIsLoading(false);
      return;
    }

    try {
      if (token) {
        const { error } = await authClient.resetPassword({
          newPassword: password,
          token,
        });
        if (error) throw error;
      } else {
        const result = await setOwnPassword(password);
        if (!result.success) {
          setError(formatServerAuthError(t, result));
          setIsLoading(false);
          return;
        }
      }
      setIsRedirecting(true);
      // Force full refresh so server components reload with updated auth state
      router.refresh();
      router.push(token ? "/auth/login" : "/");
    } catch (error: unknown) {
      setError(formatAuthError(t, error));
      setIsLoading(false);
    }
  };

  const displayError =
    error ?? (linkError ? t("auth.errors.resetLinkInvalid") : null);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.resetPassword")}</CardTitle>
          <CardDescription>{t("auth.enterNewPassword")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password">{t("auth.newPassword")}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">
                  {t("auth.confirmNewPassword")}
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {displayError && (
                <p className="text-sm text-destructive">{displayError}</p>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isRedirecting
                  ? t("auth.redirecting")
                  : isLoading
                    ? t("auth.savingPassword")
                    : t("auth.saveNewPassword")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
