"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function LandingCta({ authenticated }: { authenticated: boolean }) {
  const { t } = useTranslation();
  return (
    <Button asChild size="lg">
      <Link href={authenticated ? "/manage" : "/auth/login"}>
        {authenticated ? t("home.cta.enter") : t("home.cta.signIn")}
      </Link>
    </Button>
  );
}
