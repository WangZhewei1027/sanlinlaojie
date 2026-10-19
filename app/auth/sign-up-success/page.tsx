"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AuthButton, AuthFormShell } from "@/components/auth-form-shell";
import { Text } from "@/components/ui/typography";

export default function Page() {
  const { t } = useTranslation();
  return (
    <AuthFormShell
      title={t("auth.signUpSuccessTitle")}
      description={t("auth.signUpSuccessDescription")}
    >
      <div className="space-y-6">
        <Text as="p" variant="bodySm" tone="subdued">
          {t("auth.signUpSuccessDetail")}
        </Text>
        <AuthButton asChild>
          <Link href="/auth/login">{t("auth.backToLogin")}</Link>
        </AuthButton>
      </div>
    </AuthFormShell>
  );
}
