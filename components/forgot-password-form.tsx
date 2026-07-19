"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  SendSmsVerifyCode,
  CheckSmsVerifyCode,
  resetPasswordByPhone,
} from "@/lib/auth/sms";
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
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";

function isPhoneInput(value: string): boolean {
  return /^\d{7,15}$/.test(value.trim());
}

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [account, setAccount] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // 手机号重置流程的阶段
  const [phoneStep, setPhoneStep] = useState<"input" | "otp" | "newPassword">(
    "input",
  );
  const { t } = useTranslation();

  const isPhone = isPhoneInput(account);
  const fullPhone = `${account.trim()}`;

  // ─── 邮箱重置：发送重置链接 ────────────────────────────────
  const handleEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        account.trim(),
        { redirectTo: `${window.location.origin}/auth/update-password` },
      );
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(formatAuthError(t, error));
    } finally {
      setIsLoading(false);
    }
  };

  // ─── 手机号重置：发送验证码 ────────────────────────────────
  const handlePhoneSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await SendSmsVerifyCode(fullPhone);
      if (!result.success) {
        setError(formatServerAuthError(t, result, "auth.errors.smsSendFailed"));
        return;
      }
      setPhoneStep("otp");
    } catch (error: unknown) {
      setError(formatAuthError(t, error));
    } finally {
      setIsLoading(false);
    }
  };

  // ─── 手机号重置：验证验证码 ────────────────────────────────
  const handlePhoneVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await CheckSmsVerifyCode(fullPhone, otpCode);
      if (!result.success) {
        setError(formatServerAuthError(t, result, "auth.invalidOtpCode"));
        return;
      }
      setPhoneStep("newPassword");
    } catch (error: unknown) {
      setError(formatAuthError(t, error));
    } finally {
      setIsLoading(false);
    }
  };

  // ─── 手机号重置：设置新密码 ────────────────────────────────
  const handlePhoneSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordsMustMatch"));
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError(t("auth.passwordTooShort"));
      setIsLoading(false);
      return;
    }

    try {
      const result = await resetPasswordByPhone({
        phone: fullPhone,
        newPassword,
      });
      if (!result.success) {
        setError(formatServerAuthError(t, result));
        return;
      }
      setSuccess(true);
    } catch (error: unknown) {
      setError(formatAuthError(t, error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await SendSmsVerifyCode(fullPhone);
      if (!result.success) {
        setError(formatServerAuthError(t, result, "auth.errors.smsSendFailed"));
        return;
      }
      setOtpCode("");
    } catch (error: unknown) {
      setError(formatAuthError(t, error));
    } finally {
      setIsLoading(false);
    }
  };

  // ─── 成功页面 ──────────────────────────────────────────────
  if (success) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {isPhone ? t("auth.resetPassword") : t("auth.checkEmailForLink")}
            </CardTitle>
            <CardDescription>
              {isPhone
                ? t("auth.passwordResetSuccess")
                : t("auth.passwordResetSent")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPhone ? (
              <Link href="/auth/login">
                <Button className="w-full">{t("auth.signIn")}</Button>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("auth.passwordResetSentDetail")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── 手机号验证码阶段 ─────────────────────────────────────
  if (isPhone && phoneStep === "otp") {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {t("auth.resetPassword")}
            </CardTitle>
            <CardDescription>
              {t("auth.phoneOtpSentMessage", { phone: fullPhone })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePhoneVerifyOtp}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="otp-code">{t("auth.verificationCode")}</Label>
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      setOtpCode(value);
                    }}
                    className="text-center text-lg tracking-widest"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading
                    ? t("common.loading")
                    : t("auth.verifyAndResetPassword")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                >
                  {t("auth.resendCode")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setPhoneStep("input");
                    setOtpCode("");
                    setError(null);
                  }}
                >
                  {t("auth.changePhone")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── 手机号设置新密码阶段 ─────────────────────────────────
  if (isPhone && phoneStep === "newPassword") {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {t("auth.resetPassword")}
            </CardTitle>
            <CardDescription>{t("auth.enterNewPassword")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePhoneSetPassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-new-password">
                    {t("auth.confirmNewPassword")}
                  </Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t("common.loading") : t("auth.resetPassword")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── 初始输入阶段（邮箱或手机号）────────────────────────────
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.resetPassword")}</CardTitle>
          <CardDescription>{t("auth.enterEmailOrPhoneToReset")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isPhone ? handlePhoneSendOtp : handleEmailReset}>
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
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? t("common.loading")
                  : isPhone
                    ? t("auth.sendVerificationCode")
                    : t("auth.sendResetEmail")}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                {t("auth.signIn")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
