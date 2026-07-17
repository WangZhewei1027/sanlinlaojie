"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-next";
import {
  SendSmsVerifyCode,
  CheckSmsVerifyCode,
  createUserByPhone,
} from "@/lib/auth/sms";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// ─── 邮箱注册表单（保留原有邮件确认流程）───────────────────────

function EmailSignUpForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError(t("auth.passwordsMustMatch"));
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${next}`,
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp}>
      <div className="flex flex-col gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email-password">{t("auth.password")}</Label>
          <Input
            id="email-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email-repeat-password">
            {t("auth.repeatPassword")}
          </Label>
          <Input
            id="email-repeat-password"
            type="password"
            autoComplete="new-password"
            required
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? t("auth.creatingAccount") : t("auth.signUp")}
        </Button>
      </div>
    </form>
  );
}

// ─── 手机号注册表单（阿里云短信验证码）─────────────────────────

function PhoneSignUpForm({ next }: { next: string }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  const fullPhone = `${phone}`;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError(t("auth.passwordsMustMatch"));
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      setIsLoading(false);
      return;
    }

    try {
      const result = await SendSmsVerifyCode(fullPhone);
      if (!result.success) {
        setError(result.error || t("auth.otpSendError"));
        return;
      }

      setOtpSent(true);
      setShowOtpVerification(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 1. 校验短信验证码
      const checkResult = await CheckSmsVerifyCode(fullPhone, otpCode);
      if (!checkResult.success) {
        setError(checkResult.error || t("auth.invalidOtpCode"));
        return;
      }

      // 2. 验证码通过，服务端创建用户
      const createResult = await createUserByPhone({
        phone: fullPhone,
        password,
      });

      if (createResult.error) {
        setError(createResult.error);
        return;
      }

      // 3. 用创建好的账号登录（使用手机号对应的虚拟邮箱）
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: createResult.email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.refresh();
      router.push(next);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t("common.error"));
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
        setError(result.error || t("auth.otpSendError"));
        return;
      }
      setOtpCode("");
      setError(null);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t("auth.otpSendError"));
    } finally {
      setIsLoading(false);
    }
  };

  if (showOtpVerification) {
    return (
      <form onSubmit={handleVerifyOtp}>
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {t("auth.phoneOtpSentMessage", { phone: fullPhone })}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone-otp-code">{t("auth.verificationCode")}</Label>
            <Input
              id="phone-otp-code"
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
            {isLoading ? t("common.loading") : t("auth.verifyAndSignUp")}
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
              setShowOtpVerification(false);
              setOtpSent(false);
              setOtpCode("");
              setError(null);
            }}
          >
            {t("auth.changePhone")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOtp}>
      <div className="flex flex-col gap-6">
        <div className="grid gap-2">
          <Label htmlFor="phone">{t("auth.phone")}</Label>
          <div className="flex gap-2">
            <Input
              value="+86"
              disabled
              className="w-16 shrink-0 text-center"
              tabIndex={-1}
            />
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="13800138000"
              required
              value={phone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setPhone(value);
              }}
              maxLength={11}
              disabled={otpSent}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone-password">{t("auth.password")}</Label>
          <Input
            id="phone-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={otpSent}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone-repeat-password">
            {t("auth.repeatPassword")}
          </Label>
          <Input
            id="phone-repeat-password"
            type="password"
            autoComplete="new-password"
            required
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            disabled={otpSent}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? t("common.loading") : t("auth.sendVerificationCode")}
        </Button>
      </div>
    </form>
  );
}

// ─── 主注册表单（含 Tabs 切换）─────────────────────────────

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [activeTab, setActiveTab] = useState<string>("phone");
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const { t } = useTranslation();

  const description =
    activeTab === "email"
      ? t("auth.enterEmailAndPassword")
      : t("auth.enterPhoneAndPassword");

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.signUp")}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="mb-6 w-full">
              <TabsTrigger value="phone" className="flex-1">
                {t("auth.phoneTab")}
              </TabsTrigger>
              <TabsTrigger value="email" className="flex-1">
                {t("auth.emailTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="phone">
              <PhoneSignUpForm next={next} />
            </TabsContent>

            <TabsContent value="email">
              <EmailSignUpForm next={next} />
            </TabsContent>
          </Tabs>

          <div className="mt-4 text-center text-sm">
            {t("auth.alreadyHaveAccount")}{" "}
            <Link
              href={
                next !== "/"
                  ? `/auth/login?next=${encodeURIComponent(next)}`
                  : "/auth/login"
              }
              className="underline underline-offset-4"
            >
              {t("auth.signIn")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
