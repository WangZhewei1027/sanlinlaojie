"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AuthInput } from "@/components/auth-form-shell";
import { cn } from "@/lib/utils";

export function AuthPasswordInput({
  id,
  className,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof AuthInput>, "type">) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="relative">
      <AuthInput
        {...props}
        id={inputId}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-14", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-0.5 size-11 rounded-md"
        disabled={disabled}
        aria-label={t(visible ? "auth.hidePassword" : "auth.showPassword")}
        aria-pressed={visible}
        aria-controls={inputId}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  );
}
