"use client";
import { useTranslation } from "react-i18next";
import { CheckCircle2, CircleAlert, Clock3, ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { MatchingStatus } from "./matching-point-types";

export function MatchingFeatureStatus({ status, updatedAt, error, onRefresh }: {
  status: MatchingStatus;
  updatedAt?: string | null;
  error?: string | null;
  onRefresh?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const busy = ["loading", "processing", "saving"].includes(status);
  const failed = status === "failed" || status === "status_error";
  const Icon = busy ? Loader2 : status === "ready" ? CheckCircle2 : failed ? CircleAlert : status === "missing_image" ? ImageOff : Clock3;
  const date = updatedAt ? new Date(updatedAt) : null;
  const showDate = status === "ready" && date && Number.isFinite(date.getTime());
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={cn(
      "flex items-start gap-3 rounded-md border p-4",
      status === "ready" ? "border-success/30 bg-success/10" : failed ? "border-destructive/30 bg-destructive/10" : busy ? "border-primary/30 bg-primary/5" : "border-warning/30 bg-warning/10",
    )}>
      <Icon aria-hidden="true" className={cn("mt-0.5 h-5 w-5 shrink-0", busy && "animate-spin motion-reduce:animate-none", status === "ready" ? "text-success" : failed ? "text-destructive" : busy ? "text-primary" : "text-warning")} />
      <div className="min-w-0 flex-1 space-y-1">
        <Text as="p" variant="bodyMd" fontWeight="semibold">{t(`matching.${status}`)}</Text>
        <Text as="p" variant="bodySm">{t(`matching.statusHints.${status}`)}</Text>
        {error && <Text as="p" variant="bodySm" tone="critical" breakWord>{error}</Text>}
        {showDate && <Text as="p" variant="bodySm">{t("matching.generatedAt", { time: date.toLocaleString(i18n.resolvedLanguage || "zh") })}</Text>}
        {onRefresh && !busy && status !== "unsaved" && (
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRefresh}>{t("matching.refreshStatus")}</Button>
        )}
      </div>
    </div>
  );
}
