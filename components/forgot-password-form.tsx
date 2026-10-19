"use client";

import { normalizeChinaPhone } from "@/lib/auth/china-phone";
import {
  SendSmsVerifyCode,
  CheckSmsVerifyCode,
  resetPasswordByPhone,
} from "@/lib/auth/sms";
import { formatAuthError, formatServerAuthError } from "@/lib/auth/auth-error";
import { ForgotPasswordFormView } from "@/components/forgot-password-form-view";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function ForgotPasswordForm(
  props: React.ComponentPropsWithoutRef<"div">,
) {
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  // 验证码通过后服务端签发的凭证，重置密码时必须带上
  const [smsTicket, setSmsTicket] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // 手机号重置流程的阶段
  const [phoneStep, setPhoneStep] = useState<"input" | "otp" | "newPassword">(
    "input",
  );
  const { t } = useTranslation();

  const fullPhone = normalizeChinaPhone(phone) ?? "";

  // ─── 手机号重置：发送验证码 ────────────────────────────────
  const handlePhoneSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!fullPhone) {
      setError(t("auth.errors.invalidPhone"));
      setIsLoading(false);
      return;
    }

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
      setSmsTicket(result.ticket ?? "");
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
        ticket: smsTicket,
      });
      if (!result.success) {
        setError(formatServerAuthError(t, result));
        // 凭证过期：回到验证码页，用户可点「重新发送」
        if (result.code === "code_expired") {
          setOtpCode("");
          setPhoneStep("otp");
        }
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

  return (
    <ForgotPasswordFormView
      {...props}
      stage={success ? "success" : phoneStep}
      phone={phone}
      password={newPassword}
      confirmation={confirmPassword}
      code={otpCode}
      onPhoneChange={setPhone}
      onPasswordChange={setNewPassword}
      onConfirmationChange={setConfirmPassword}
      onCodeChange={setOtpCode}
      onSubmit={
        phoneStep === "otp"
          ? handlePhoneVerifyOtp
          : phoneStep === "newPassword"
            ? handlePhoneSetPassword
            : handlePhoneSendOtp
      }
      onResend={handleResendOtp}
      onRestart={() => {
        setSuccess(false);
        setPhoneStep("input");
        setOtpCode("");
        setSmsTicket("");
        setError(null);
      }}
      isLoading={isLoading}
      error={error}
    />
  );
}
