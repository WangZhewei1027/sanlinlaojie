"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-next";
import { formatAuthError } from "@/lib/auth/auth-error";
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
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// 手机号对应的虚拟邮箱域名，必须与 lib/auth/sms.ts 中保持一致
const PHONE_EMAIL_DOMAIN = "phone.sanlinlaojie.local";

// 判断输入是否为手机号（纯数字），是则拼接虚拟邮箱
function resolveEmail(input: string): string {
  const trimmed = input.trim();
  if (/^\d{7,15}$/.test(trimmed)) {
    return `${trimmed}@${PHONE_EMAIL_DOMAIN}`;
  }
  return trimmed;
}

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: resolveEmail(account),
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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.signIn")}</CardTitle>
          <CardDescription>{t("auth.enterEmailOrPhone")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="account">{t("auth.emailOrPhone")}</Label>
                <Input
                  id="account"
                  type="text"
                  autoComplete="username"
                  placeholder="m@example.com / 13800138000"
                  required
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    {t("auth.forgotPassword")}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isRedirecting
                  ? t("auth.redirecting")
                  : isLoading
                    ? t("auth.loggingIn")
                    : t("auth.signIn")}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              {t("auth.dontHaveAccount")}{" "}
              <Link
                href={
                  next !== "/"
                    ? `/auth/sign-up?next=${encodeURIComponent(next)}`
                    : "/auth/sign-up"
                }
                className="underline underline-offset-4"
              >
                {t("auth.signUp")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
