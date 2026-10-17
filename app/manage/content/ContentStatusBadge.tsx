"use client";

import { useTranslation } from "react-i18next";
import {
  Archive,
  ArrowUpCircle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  FileWarning,
  type LucideIcon,
} from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ContentBadgeKind =
  | "archived"
  | "fileMissing"
  | "unpublished"
  | "published"
  | "changed"
  | "outdated";

type Tone = "neutral" | "quiet" | "success" | "warning" | "critical";

const KINDS: Record<ContentBadgeKind, { icon: LucideIcon; tone: Tone }> = {
  archived: { icon: Archive, tone: "quiet" },
  fileMissing: { icon: FileWarning, tone: "critical" },
  unpublished: { icon: CircleDashed, tone: "neutral" },
  published: { icon: CircleCheck, tone: "success" },
  changed: { icon: CircleDot, tone: "warning" },
  outdated: { icon: ArrowUpCircle, tone: "warning" },
};

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-border bg-background text-foreground",
  quiet: "border-transparent bg-muted text-muted-foreground",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
};

export interface ContentStatusBadgeProps {
  kind: ContentBadgeKind;
  /** Revision for "published", or the newest version for "outdated". */
  number?: number | null;
  className?: string;
}

/** One status vocabulary for asset lifecycle and scene publication. */
export function ContentStatusBadge({ kind, number, className }: ContentStatusBadgeProps) {
  const { t } = useTranslation();
  const { icon: Icon, tone } = KINDS[kind];
  const label =
    number != null && (kind === "published" || kind === "outdated")
      ? t(`contentModel.badge.${kind}Numbered`, { number })
      : t(`contentModel.badge.${kind}`);
  return (
    <span className={cn(badgeVariants({ variant: "outline" }), "gap-1 whitespace-nowrap px-1.5 py-0 font-medium", TONE_CLASSES[tone], className)}>
      <Icon className="size-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
