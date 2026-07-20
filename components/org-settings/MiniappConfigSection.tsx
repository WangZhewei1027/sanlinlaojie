"use client";

import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "./SectionHeader";
import { Text } from "@/components/ui/typography";

interface MiniappConfigSectionProps {
  confettiEnabled: boolean;
  setConfettiEnabled: (v: boolean) => void;
  shopCheckinEnabled: boolean;
  setShopCheckinEnabled: (v: boolean) => void;
  footerEnabled: boolean;
  setFooterEnabled: (v: boolean) => void;
}

export function MiniappConfigSection({
  confettiEnabled,
  setConfettiEnabled,
  shopCheckinEnabled,
  setShopCheckinEnabled,
  footerEnabled,
  setFooterEnabled,
}: MiniappConfigSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-3">
      <SectionHeader
        icon={Sparkles}
        label={t(
          "superAdmin.orgs.section.miniappConfig",
          "Mini Program Config",
        )}
      />
      <div className="flex items-start gap-3">
        <Checkbox
          id="confetti-enabled"
          checked={confettiEnabled}
          onCheckedChange={(v) => setConfettiEnabled(v === true)}
        />
        <div className="space-y-0.5">
          <Label htmlFor="confetti-enabled" className="text-sm cursor-pointer">
            {t("superAdmin.orgs.miniappConfig.confetti", "Confetti Effect")}
          </Label>
          <Text as="p" variant="bodySm" tone="subdued">
            {t(
              "superAdmin.orgs.miniappConfig.confettiDesc",
              "Show confetti ribbons in the mini program",
            )}
          </Text>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="shop-checkin-enabled"
          checked={shopCheckinEnabled}
          onCheckedChange={(v) => setShopCheckinEnabled(v === true)}
        />
        <div className="space-y-0.5">
          <Label
            htmlFor="shop-checkin-enabled"
            className="text-sm cursor-pointer"
          >
            {t("superAdmin.orgs.miniappConfig.shopCheckin", "Shop Check-in")}
          </Label>
          <Text as="p" variant="bodySm" tone="subdued">
            {t(
              "superAdmin.orgs.miniappConfig.shopCheckinDesc",
              "Show the shop check-in module in the mini program",
            )}
          </Text>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="footer-enabled"
          checked={footerEnabled}
          onCheckedChange={(v) => setFooterEnabled(v === true)}
        />
        <div className="space-y-0.5">
          <Label htmlFor="footer-enabled" className="text-sm cursor-pointer">
            {t("superAdmin.orgs.miniappConfig.footer", "Footer Logo")}
          </Label>
          <Text as="p" variant="bodySm" tone="subdued">
            {t(
              "superAdmin.orgs.miniappConfig.footerDesc",
              "Show the footer logo on the mini program home page",
            )}
          </Text>
        </div>
      </div>
    </section>
  );
}
