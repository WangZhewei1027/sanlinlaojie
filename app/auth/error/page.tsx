"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { AuthButton, AuthFormShell } from "@/components/auth-form-shell";
import { Text } from "@/components/ui/typography";

function ErrorContent() {
  const searchParams = useSearchParams();
  const detail = searchParams.get("error");
  const { t } = useTranslation();
  return (
    <Text as="p" tone="subdued" role="alert" breakWord>
      {detail
        ? t("auth.errorPageDetail", { detail })
        : t("auth.errorPageUnknown")}
    </Text>
  );
}

export default function Page() {
  const { t } = useTranslation();
  return (
    <AuthFormShell title={t("auth.errorPageTitle")}>
      <div className="space-y-6">
        <Suspense fallback={null}>
          <ErrorContent />
        </Suspense>
        <AuthButton asChild>
          <Link href="/auth/login">{t("auth.backToLogin")}</Link>
        </AuthButton>
      </div>
    </AuthFormShell>
  );
}
