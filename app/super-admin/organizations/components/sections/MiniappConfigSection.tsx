"use client";

import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "../SectionHeader";

interface MiniappConfigSectionProps {
  confettiEnabled: boolean;
  setConfettiEnabled: (v: boolean) => void;
}

export function MiniappConfigSection({
  confettiEnabled,
  setConfettiEnabled,
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
          <p className="text-xs text-muted-foreground">
            {t(
              "superAdmin.orgs.miniappConfig.confettiDesc",
              "Show confetti ribbons in the mini program",
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
