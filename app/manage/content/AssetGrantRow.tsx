"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ContentFailureNotice } from "./ContentFeedback";
import { ContentStatusBadge } from "./ContentStatusBadge";
import { useContentAction } from "./useContentAction";
import type { AssetProjectGrant, ContentAction } from "./types";

export interface AssetGrantRowProps {
  grant: AssetProjectGrant;
  canRevoke: boolean;
  onRevoke: ContentAction<[projectId: string]>;
}

/** One project's use grant with an inline, reversible revoke confirmation. */
export function AssetGrantRow({ grant, canRevoke, onRevoke }: AssetGrantRowProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const action = useContentAction();
  const blocked = grant.dependencyCount > 0;

  const revoke = async () => {
    if (await action.run(() => onRevoke(grant.projectId))) setConfirming(false);
  };

  return (
    <li className="space-y-2 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Text as="span" variant="bodySm" fontWeight="medium" truncate className="min-w-0 max-w-full" title={grant.projectName}>{grant.projectName}</Text>
        {grant.isOrigin && <span className={`${badgeVariants({ variant: "secondary" })} px-1.5 py-0 font-medium`}>{t("contentModel.sharing.origin")}</span>}
        {grant.archived && <ContentStatusBadge kind="archived" />}
        <Text as="span" variant="bodyXs" tone="subdued" className="tabular-nums">
          {blocked ? t("contentModel.sharing.dependencies", { count: grant.dependencyCount }) : t("contentModel.sharing.noDependencies")}
        </Text>
        {canRevoke && !confirming && (
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto"
            disabled={blocked}
            onClick={() => setConfirming(true)}
            aria-label={t("contentModel.sharing.revokeNamed", { name: grant.projectName })}
            title={blocked ? t("contentModel.sharing.revokeBlocked") : undefined}
          >
            {t("contentModel.sharing.revoke")}
          </Button>
        )}
      </div>
      {canRevoke && blocked && !confirming && (
        <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.sharing.revokeBlocked")}</Text>
      )}
      {confirming && (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/50 px-3 py-2 sm:flex-row sm:items-center">
          <Text as="p" variant="bodySm" className="flex-1">{t("contentModel.sharing.revokeConfirm", { name: grant.projectName })}</Text>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setConfirming(false); action.reset(); }} disabled={action.pending}>
              {t("contentModel.action.cancel")}
            </Button>
            <Button variant="outline" size="sm" onClick={revoke} disabled={action.pending}>
              {action.pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("contentModel.sharing.revokeAction")}
            </Button>
          </div>
        </div>
      )}
      {action.failure && <ContentFailureNotice failure={action.failure} />}
    </li>
  );
}
