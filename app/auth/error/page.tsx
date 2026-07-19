"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";

function ErrorContent() {
  const searchParams = useSearchParams();
  const detail = searchParams.get("error");
  const { t } = useTranslation();

  return (
    <p className="text-sm text-muted-foreground">
      {detail
        ? t("auth.errorPageDetail", { detail })
        : t("auth.errorPageUnknown")}
    </p>
  );
}

export default function Page() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {t("auth.errorPageTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Suspense>
                <ErrorContent />
              </Suspense>
              <Link href="/auth/login">
                <Button className="w-full">{t("auth.backToLogin")}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
