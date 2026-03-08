"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { isSuperAdmin } from "@/lib/permissions";

export default function Home() {
  const { t } = useTranslation();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isViewerOnly, setIsViewerOnly] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/role")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetch("/api/organizations")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ]).then(([roleData, orgsData]) => {
      if (roleData?.role) setUserRole(roleData.role);

      // 如果全局不是 super_admin，且所有 org 角色都是 viewer，则视为 viewer-only
      const globalRole = roleData?.role ?? null;
      if (!isSuperAdmin(globalRole)) {
        const orgs: { role?: string }[] = orgsData?.data ?? [];
        if (orgs.length > 0 && orgs.every((o) => o.role === "viewer")) {
          setIsViewerOnly(true);
        }
      }
    });
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5 w-full">
          <main className="flex-1 flex flex-col gap-6 px-4">
            {/* Hero Title */}
            <section className="flex flex-col items-center gap-4 pt-12">
              <h1 className="text-4xl md:text-5xl font-bold text-center">
                {t("home.hero.title")}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground text-center">
                {t("home.hero.subtitle")}
              </p>
            </section>

            {/* Super Admin Entry */}
            {isSuperAdmin(userRole) && (
              <section className="flex justify-center">
                <Button
                  asChild
                  variant="default"
                  className="h-auto py-4 px-8 w-full max-w-2xl"
                >
                  <Link
                    href="/super-admin"
                    className="flex items-center justify-center gap-3"
                  >
                    <Shield className="h-5 w-5" />
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-lg font-semibold">
                        {t("home.quickLinks.superAdmin.title")}
                      </span>
                      <span className="text-sm opacity-80 font-normal">
                        {t("home.quickLinks.superAdmin.description")}
                      </span>
                    </div>
                  </Link>
                </Button>
              </section>
            )}

            {/* Quick Links */}
            <section className="flex flex-col items-center gap-6 py-12">
              <h2 className="text-3xl font-bold">
                {t("home.quickLinks.title")}
              </h2>
              <div className="grid md:grid-cols-2 gap-4 w-full max-w-2xl">
                {!isViewerOnly && (
                  <Button asChild variant="outline" className="h-auto py-6">
                    <Link href="/upload-onsite" className="flex flex-col gap-2">
                      <span className="text-lg font-semibold">
                        {t("home.quickLinks.onsite.title")}
                      </span>
                      <span className="text-sm text-muted-foreground font-normal">
                        {t("home.quickLinks.onsite.description")}
                      </span>
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" className="h-auto py-6">
                  <Link href="/manage" className="flex flex-col gap-2">
                    <span className="text-lg font-semibold">
                      {t("home.quickLinks.manage.title")}
                    </span>
                    <span className="text-sm text-muted-foreground font-normal">
                      {t("home.quickLinks.manage.description")}
                    </span>
                  </Link>
                </Button>
                {!isViewerOnly && (
                  <Button asChild variant="outline" className="h-auto py-6">
                    <Link href="/admin" className="flex flex-col gap-2">
                      <span className="text-lg font-semibold">
                        {t("home.quickLinks.admin.title")}
                      </span>
                      <span className="text-sm text-muted-foreground font-normal">
                        {t("home.quickLinks.admin.description")}
                      </span>
                    </Link>
                  </Button>
                )}
              </div>
            </section>
          </main>
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
          <p className="text-muted-foreground">{t("home.footer.copyright")}</p>
        </footer>
      </div>
    </main>
  );
}
