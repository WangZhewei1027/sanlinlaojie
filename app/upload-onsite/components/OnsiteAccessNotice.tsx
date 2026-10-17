"use client";

import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import type { IntegrationT } from "@/app/manage/lib/integration-text";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";

interface OnsiteAccessNoticeProps {
  tx: IntegrationT;
  teamArchived: boolean;
  hasCollection: boolean;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  archived: boolean;
  canEdit: boolean;
  onRetry: () => void;
}

/** Why capture is unavailable; capability comes from the server only. */
export function OnsiteAccessNotice({ tx, teamArchived, hasCollection, status, error, archived, canEdit, onRetry }: OnsiteAccessNoticeProps) {
  if (teamArchived) {
    return (
      <ContentNotice
        tone="warning"
        title={tx("contentModel.integration.onsite.readonlyTitle")}
        description={tx("contentModel.integration.onsite.readonlyBody")}
      />
    );
  }
  if (!hasCollection || canEdit) return null;
  if (status === "loading" || status === "idle") {
    return <Text as="p" variant="bodySm" tone="subdued" role="status">{tx("contentModel.integration.onsite.checkingAccess")}</Text>;
  }
  if (status === "error") {
    return (
      <ContentNotice
        tone="critical"
        title={tx("contentModel.integration.onsite.accessError")}
        description={error ?? undefined}
        action={<Button variant="outline" size="sm" onClick={onRetry}>{tx("contentModel.action.retry")}</Button>}
      />
    );
  }
  if (archived) {
    return (
      <ContentNotice
        tone="warning"
        title={tx("contentModel.integration.onsite.archivedTitle")}
        description={tx("contentModel.integration.onsite.archivedBody")}
      />
    );
  }
  return (
    <ContentNotice
      tone="warning"
      title={tx("contentModel.integration.onsite.noEditTitle")}
      description={tx("contentModel.integration.onsite.noEditBody")}
    />
  );
}
