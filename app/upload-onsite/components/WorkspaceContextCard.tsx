"use client";

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
}

export function WorkspaceContextCard({
  workspaceId,
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

      <div className="flex min-w-0 items-center gap-1">
        <OrgSwitcher className="max-w-none min-w-0 flex-shrink" />
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" />
        <WorkspaceSwitcher className="max-w-none min-w-0 flex-1 justify-start" />
      </div>

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
