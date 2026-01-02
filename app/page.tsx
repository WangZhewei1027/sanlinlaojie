"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { t } = useTranslation();

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

            {/* Quick Links */}
            <section className="flex flex-col items-center gap-6 py-12">
              <h2 className="text-3xl font-bold">
                {t("home.quickLinks.title")}
              </h2>
              <div className="grid md:grid-cols-2 gap-4 w-full max-w-2xl">
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
                {/* <Button asChild variant="outline" className="h-auto py-6">
                  <Link href="/ar" className="flex flex-col gap-2">
                    <span className="text-lg font-semibold">AR 体验</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      增强现实内容浏览
                    </span>
                  </Link>
                </Button> */}
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
