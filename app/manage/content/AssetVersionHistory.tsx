"use client";

import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { ContentErrorState, ContentListSkeleton } from "./ContentFeedback";
import { ContentSection } from "./ContentSection";
import { useContentFormat } from "./useContentFormat";
import type { AssetVersion, ContentLoadStatus } from "./types";

export interface AssetVersionHistoryProps {
  versions: AssetVersion[];
  currentVersionId: string;
  status?: ContentLoadStatus;
  onRetry?: () => void;
  /** Version used to filter usage; null shows usage of every version. */
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string | null) => void;
}

/** Immutable version list, newest first. Selecting a version narrows the usage list. */
export function AssetVersionHistory({ versions, currentVersionId, status = "ready", onRetry, selectedVersionId, onSelectVersion }: AssetVersionHistoryProps) {
  const { t } = useTranslation();
  const format = useContentFormat();
  const ordered = [...versions].sort((a, b) => b.versionNo - a.versionNo);

  return (
    <ContentSection
      title={t("contentModel.version.title")}
      description={t("contentModel.version.pinnedHint")}
      actions={selectedVersionId && (
        <Button variant="ghost" size="sm" onClick={() => onSelectVersion(null)}>{t("contentModel.version.showAllUsage")}</Button>
      )}
    >
      {status === "loading" && <ContentListSkeleton rows={3} label={t("contentModel.state.loading")} />}
      {status === "error" && <ContentErrorState onRetry={onRetry} />}
      {status === "ready" && (
        <ol className="divide-y" aria-label={t("contentModel.version.title")}>
          {ordered.map((version) => {
            const selected = version.id === selectedVersionId;
            const current = version.id === currentVersionId;
            const meta = [
              format.dateTime(version.createdAt),
              version.createdBy?.name,
              version.sizeBytes != null ? format.size(version.sizeBytes) : null,
            ].filter(Boolean).join(" · ");
            return (
              <li key={version.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectVersion(selected ? null : version.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
                    selected ? "bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <span className="w-10 shrink-0 pt-0.5 text-sm font-semibold tabular-nums">v{version.versionNo}</span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {current && <span className={cn(badgeVariants({ variant: "secondary" }), "px-1.5 py-0 font-medium")}>{t("contentModel.version.current")}</span>}
                      <Text as="span" variant="bodyXs" tone="subdued">{meta}</Text>
                    </span>
                    {version.note && <Text as="span" variant="bodySm" className="block" breakWord>{version.note}</Text>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 pt-0.5">
                    {version.usageCount != null && (
                      <Text as="span" variant="bodyXs" tone="subdued" className="tabular-nums">
                        {version.usageCount ? t("contentModel.usage.count", { count: version.usageCount }) : t("contentModel.usage.none")}
                      </Text>
                    )}
                    <Check className={cn("size-4", selected ? "text-foreground" : "invisible")} aria-hidden />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </ContentSection>
  );
}
