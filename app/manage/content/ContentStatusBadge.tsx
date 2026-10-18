"use client";

import { useTranslation } from "react-i18next";
import {
  Archive,
  FileWarning,
  type LucideIcon,
} from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ContentBadgeKind =
  | "archived"
  | "fileMissing";

type Tone = "neutral" | "quiet" | "success" | "warning" | "critical";

const KINDS: Record<ContentBadgeKind, { icon: LucideIcon; tone: Tone }> = {
  archived: { icon: Archive, tone: "quiet" },
  fileMissing: { icon: FileWarning, tone: "critical" },
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
  className?: string;
}

/** One status vocabulary for asset lifecycle and scene publication. */
export function ContentStatusBadge({ kind, className }: ContentStatusBadgeProps) {
  const { t } = useTranslation();
  const { icon: Icon, tone } = KINDS[kind];
  const label = t(`contentModel.badge.${kind}`);
  return (
    <span className={cn(badgeVariants({ variant: "outline" }), "gap-1 whitespace-nowrap px-1.5 py-0 font-medium", TONE_CLASSES[tone], className)}>
      <Icon className="size-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
