"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronRight, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OrgSwitcher } from "@/components/org-switcher";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/typography";

interface WorkspaceContextCardProps {
  /** Normalized workspace id (null when none or "All workspaces" selected) */
  workspaceId: string | null;
  /**
   * Project fixed by explicit URL parameters (v2 path). Replaces the
   * switchers, which show the persisted selection, until the user clears it.
   */
  pinned?: { label: string; projectName: string; clearLabel: string; clearHref: string } | null;
}

export function WorkspaceContextCard({
  workspaceId,
  pinned,
}: WorkspaceContextCardProps) {
  const { t } = useTranslation();
  const needsSelection = !workspaceId;

  return (
    <Card
      className={cn(
        "space-y-3 p-4",
        needsSelection &&
          "border-warning/60 bg-warning/10",
      )}
    >
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <Text as="h2" variant="bodySm" fontWeight="medium">
          {t("onsite.uploadingTo", "Uploading to")}
        </Text>
      </div>

      {pinned ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <Text as="p" variant="bodySm" fontWeight="medium" truncate>
              {pinned.projectName}
            </Text>
            <Text as="p" variant="bodyXs" tone="subdued">
              {pinned.label}
            </Text>
          </div>
          <Link
            href={pinned.clearHref}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {pinned.clearLabel}
          </Link>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col items-stretch gap-1 sm:flex-row sm:items-center">
          <OrgSwitcher className="w-full min-w-0 max-w-full justify-start sm:w-auto sm:max-w-none sm:flex-1 [&>span]:flex-1 [&>span]:text-left" />
          <ChevronRight className="hidden h-4 w-4 flex-shrink-0 text-muted-foreground/60 sm:block" />
          <WorkspaceSwitcher className="w-full min-w-0 max-w-full justify-start sm:w-auto sm:max-w-none sm:flex-1 [&>span]:flex-1 [&>span]:text-left" />
        </div>
      )}

      {needsSelection && (
        <div className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            {t(
              "onsite.selectWorkspaceFirst",
              "Please select a specific workspace before uploading",
            )}
          </span>
        </div>
      )}
    </Card>
  );
}
