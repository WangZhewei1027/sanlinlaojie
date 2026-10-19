"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { AuthButton, AuthError, AuthInput } from "@/components/auth-form-shell";
import { Label } from "@/components/ui/label";

export interface AuthCodeFormProps {
  code: string;
  onCodeChange: (value: string) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onResend: () => void;
  onChangePhone: () => void;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
}

export function AuthCodeForm({
  code,
  onCodeChange,
  onSubmit,
  onResend,
  onChangePhone,
  submitLabel,
  busy = false,
  error,
}: AuthCodeFormProps) {
  const id = useId();
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit}>
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
        <div className="grid gap-2">
          <Label htmlFor={id}>{t("auth.verificationCode")}</Label>
          <AuthInput
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            required
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            value={code}
            onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, ""))}
            className="text-center text-lg tabular-nums tracking-widest"
            autoFocus
          />
        </div>
        <AuthError>{error}</AuthError>
        <div className="space-y-3">
          <AuthButton type="submit" disabled={busy} aria-busy={busy}>
            {submitLabel}
          </AuthButton>
          <AuthButton
            type="button"
            variant="outline"
            onClick={onResend}
            disabled={busy}
          >
            {t("auth.resendCode")}
          </AuthButton>
          <AuthButton
            type="button"
            variant="ghost"
            onClick={onChangePhone}
            disabled={busy}
          >
            {t("auth.changePhone")}
          </AuthButton>
        </div>
      </fieldset>
    </form>
  );
}
