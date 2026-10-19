"use client";

import { authClient } from "@/lib/auth/client";
import { safeNext } from "@/lib/safe-next";
import {
  SendSmsVerifyCode,
  CheckSmsVerifyCode,
  createUserByPhone,
} from "@/lib/auth/sms";
import { formatAuthError, formatServerAuthError } from "@/lib/auth/auth-error";
import { normalizeChinaPhone } from "@/lib/auth/china-phone";
import { useGoogleSignIn } from "@/lib/auth/use-google-sign-in";
import { SignUpFormView } from "@/components/sign-up-form-view";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function SignUpForm(props: React.ComponentPropsWithoutRef<"div">) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const google = useGoogleSignIn(next);
  const loginHref =
    next !== "/"
      ? `/auth/login?next=${encodeURIComponent(next)}`
      : "/auth/login";
  const router = useRouter();
  const { t } = useTranslation();

  const fullPhone = normalizeChinaPhone(phone) ?? "";
  const setBusy = (busy: boolean) => {
    setIsLoading(busy);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (!fullPhone) {
      setError(t("auth.errors.invalidPhone"));
      setBusy(false);
      return;
    }

    if (password !== repeatPassword) {
      setError(t("auth.passwordsMustMatch"));
      setBusy(false);
      return;
    }

    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      setBusy(false);
      return;
    }

    try {
      const result = await SendSmsVerifyCode(fullPhone);
      if (!result.success) {
        setError(formatServerAuthError(t, result, "auth.errors.smsSendFailed"));
        return;
      }

      setShowOtpVerification(true);
    } catch (error: unknown) {
      setError(formatAuthError(t, error));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let redirecting = false;

    try {
      // 1. 校验短信验证码
      const checkResult = await CheckSmsVerifyCode(fullPhone, otpCode);
      if (!checkResult.success) {
        setError(formatServerAuthError(t, checkResult, "auth.invalidOtpCode"));
        return;
      }

      // 2. 验证码通过，服务端凭验证凭证创建用户
      const createResult = await createUserByPhone({
        phone: fullPhone,
        password,
        ticket: checkResult.ticket ?? "",
      });

      if (createResult.error) {
        setError(formatServerAuthError(t, createResult));
        return;
      }

      setAccountCreated(true);

      // 3. 用创建好的账号登录（使用手机号对应的虚拟邮箱）
      const { error: signInError } = await authClient.signIn.email({
        email: createResult.email,
        password,
      });

      if (signInError) {
        // 账号已创建成功，只是自动登录失败——明确告知，避免用户重复注册
        setError(t("auth.errors.accountCreatedLoginFailed"));
        return;
      }

      // 注册并登录成功：保持按钮禁用并提示跳转中
      redirecting = true;
      setIsRedirecting(true);
      router.refresh();
      router.push(next);
    } catch (error: unknown) {
      setError(formatAuthError(t, error));
    } finally {
      if (!redirecting) {
        setBusy(false);
      }
    }
  };

  const handleResendOtp = async () => {
    setBusy(true);
    setError(null);

    try {
      const result = await SendSmsVerifyCode(fullPhone);
      if (!result.success) {
        setError(formatServerAuthError(t, result, "auth.errors.smsSendFailed"));
        return;
      }
      setOtpCode("");
      setError(null);
    } catch (error: unknown) {
      setError(formatAuthError(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SignUpFormView
      {...props}
      stage={
        accountCreated && !isLoading
          ? "created"
          : showOtpVerification
            ? "otp"
            : "details"
      }
      phone={phone}
      password={password}
      confirmation={repeatPassword}
      code={otpCode}
      onPhoneChange={setPhone}
      onPasswordChange={setPassword}
      onConfirmationChange={setRepeatPassword}
      onCodeChange={setOtpCode}
      onSubmit={showOtpVerification ? handleVerifyOtp : handleSendOtp}
      onResend={handleResendOtp}
      onChangePhone={() => {
        setShowOtpVerification(false);
        setOtpCode("");
        setError(null);
      }}
      onGoogleSignIn={google.signIn}
      loginHref={loginHref}
      isLoading={isLoading}
      isRedirecting={isRedirecting}
      isGoogleLoading={google.isLoading}
      error={error}
      googleError={google.error}
    />
  );
}
