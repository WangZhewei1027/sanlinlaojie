"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";

export function LandingPage({ cta }: { cta: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const guideLang = i18n.language?.startsWith("en") ? "en" : "zh";

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      <section className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-20 text-center">
        <h1 className="text-display md:text-display-lg font-bold max-w-3xl">
          {t("home.hero.title")}
        </h1>
        <Text as="p" variant="bodyMd" tone="subdued" className="max-w-xl">
          {t("home.hero.description")}
        </Text>
        <div className="flex items-center gap-3 pt-2 min-h-11">
          {cta}
          <Button asChild variant="ghost" size="lg">
            <Link href={`/instructions/${guideLang}`}>
              {t("home.cta.instructions")}
            </Link>
          </Button>
        </div>
        <Text as="p" variant="bodySm" tone="subdued">
          {t("home.hero.subtitle")}
        </Text>
      </section>

      <footer className="w-full flex items-center justify-center border-t text-xs py-10">
        <p className="text-muted-foreground">{t("home.footer.copyright")}</p>
      </footer>
    </main>
  );
}
