"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { AuthPasswordInput } from "@/components/auth-password-input";

export interface AuthPasswordFieldsProps {
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  signUp?: boolean;
  autoFocus?: boolean;
}

export function AuthPasswordFields({
  password,
  confirmation,
  onPasswordChange,
  onConfirmationChange,
  signUp = false,
  autoFocus = false,
}: AuthPasswordFieldsProps) {
  const id = useId();
  const { t } = useTranslation();
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-password`}>
          {t(signUp ? "auth.password" : "auth.newPassword")}
        </Label>
        <AuthPasswordInput
          id={`${id}-password`}
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          autoFocus={autoFocus}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-confirmation`}>
          {t(signUp ? "auth.repeatPassword" : "auth.confirmNewPassword")}
        </Label>
        <AuthPasswordInput
          id={`${id}-confirmation`}
          autoComplete="new-password"
          minLength={8}
          required
          value={confirmation}
          onChange={(e) => onConfirmationChange(e.target.value)}
        />
      </div>
    </>
  );
}
