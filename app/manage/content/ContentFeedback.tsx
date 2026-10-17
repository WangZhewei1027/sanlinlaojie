"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info, OctagonAlert, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ContentActionFailure } from "./useContentAction";

export interface ContentEmptyStateProps {
  title: string;
  /** h2 when the state sits directly under the page heading, h3 inside a section. */
  headingAs?: "h2" | "h3";
  description?: string;
  actions?: ReactNode;
}

/** Empty region that names the next step instead of "nothing here". */
export function ContentEmptyState({ title, description, actions, headingAs = "h3" }: ContentEmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-10 sm:items-center sm:px-6 sm:text-center">
      <Text as={headingAs} variant="bodyMd" fontWeight="semibold" tone="default">{title}</Text>
      {description && <Text as="p" variant="bodySm" tone="subdued" className="max-w-md">{description}</Text>}
      {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export interface ContentErrorStateProps {
  message?: string;
  headingAs?: "h2" | "h3";
  onRetry?: () => void;
}

export function ContentErrorState({ message, onRetry, headingAs = "h3" }: ContentErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-start gap-2 px-4 py-10 sm:items-center sm:px-6 sm:text-center">
      <Text as={headingAs} variant="bodyMd" fontWeight="semibold" tone="critical">{t("contentModel.state.loadFailed")}</Text>
      <Text as="p" variant="bodySm" tone="subdued" className="max-w-md">{message || t("contentModel.state.loadFailedHint")}</Text>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          <RotateCw aria-hidden />
          {t("contentModel.action.retry")}
        </Button>
      )}
    </div>
  );
}

export type ContentNoticeTone = "info" | "warning" | "critical";

const NOTICE_STYLES: Record<
  ContentNoticeTone,
  { icon: typeof Info; box: string; iconClass: string; text: "default" | "warning" | "critical" }
> = {
  info: { icon: Info, box: "border-border bg-muted/50", iconClass: "text-muted-foreground", text: "default" },
  warning: { icon: AlertTriangle, box: "border-warning/30 bg-warning/10", iconClass: "text-warning", text: "warning" },
  critical: { icon: OctagonAlert, box: "border-destructive/30 bg-destructive/10", iconClass: "text-destructive", text: "critical" },
};

export interface ContentNoticeProps {
  tone?: ContentNoticeTone;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Inline banner for archive, read-only, conflict and action failures. */
export function ContentNotice({ tone = "info", title, description, action, className }: ContentNoticeProps) {
  const style = NOTICE_STYLES[tone];
  const Icon = style.icon;
  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      className={cn("flex flex-col gap-3 rounded-md border px-3 py-2.5 sm:flex-row sm:items-start", style.box, className)}
    >
      <div className="flex min-w-0 flex-1 gap-2">
        <Icon className={cn("mt-0.5 size-4 shrink-0", style.iconClass)} aria-hidden />
        <div className="min-w-0 space-y-1">
          <Text as="p" variant="bodySm" fontWeight="medium" tone={style.text}>{title}</Text>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>
      </div>
      {action && <div className="flex shrink-0 gap-2 ps-6 sm:ps-0">{action}</div>}
    </div>
  );
}

/** Renders a failed callback result with its localized impact lines. */
export function ContentFailureNotice({ failure, onRetry, className }: { failure: ContentActionFailure; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation();
  const title = failure.kind === "conflict"
    ? t("contentModel.state.conflict")
    : failure.kind === "forbidden"
      ? t("contentModel.state.forbidden")
      : t("contentModel.state.actionFailed");
  return (
    <ContentNotice
      tone={failure.kind === "error" ? "critical" : "warning"}
      title={title}
      className={className}
      description={Boolean(failure.message || failure.details?.length) && (
        <>
          {failure.message && <p>{failure.message}</p>}
          {!!failure.details?.length && (
            <ul className="mt-1 list-disc space-y-0.5 ps-4">
              {failure.details.map((line) => <li key={line}>{line}</li>)}
            </ul>
          )}
        </>
      )}
      action={onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("contentModel.action.reload")}</Button>}
    />
  );
}

/** Row-shaped skeleton matching the library and scene list rhythm. */
export function ContentListSkeleton({ rows = 5, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="divide-y">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="size-16 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="hidden h-8 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}
