"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive, ArchiveRestore, Loader2, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { AssetArchiveDialog } from "./AssetArchiveDialog";
import { AssetMaintainerDialog } from "./AssetMaintainerDialog";
import { ContentFailureNotice } from "./ContentFeedback";
import { ContentSection } from "./ContentSection";
import { useContentAction } from "./useContentAction";
import type { AssetUsageKind, ContentAction, ContentLifecycle, ContentPerson } from "./types";

export interface AssetMaintenancePanelProps {
  assetName: string;
  state: ContentLifecycle;
  maintainer: ContentPerson | null;
  /** Maintainer or organization owner/admin. */
  canMaintain: boolean;
  /** Organization owner/admin only. */
  canTransfer: boolean;
  candidates: ContentPerson[];
  impact: Record<AssetUsageKind, number>;
  onTransfer: ContentAction<[personId: string]>;
  onArchive: ContentAction;
  onRestore: ContentAction;
}

export function AssetMaintenancePanel(props: AssetMaintenancePanelProps) {
  const { t } = useTranslation();
  const [transferOpen, setTransferOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const restore = useContentAction();
  const archived = props.state === "archived";

  return (
    <ContentSection title={t("contentModel.maintenance.title")}>
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <Text as="p" variant="bodyXs" tone="subdued">{t("contentModel.detail.maintainer")}</Text>
            {props.maintainer ? (
              <Text as="p" variant="bodySm" fontWeight="medium" truncate title={props.maintainer.name}>{props.maintainer.name}</Text>
            ) : (
              <Text as="p" variant="bodySm" tone="warning">{t("contentModel.maintenance.unassigned")}</Text>
            )}
          </div>
          {props.canTransfer && (
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
              <UserRoundCog aria-hidden />
              {props.maintainer ? t("contentModel.maintenance.transfer") : t("contentModel.maintenance.assign")}
            </Button>
          )}
        </div>
        <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.maintenance.roleHint")}</Text>
      </div>

      {props.canMaintain && (
        <div className="space-y-2 border-t px-4 py-3">
          <Text as="p" variant="bodySm" tone="subdued">
            {archived ? t("contentModel.maintenance.archivedBody") : t("contentModel.maintenance.archiveHint")}
          </Text>
          {archived ? (
            <Button variant="outline" size="sm" onClick={() => restore.run(props.onRestore)} disabled={restore.pending}>
              {restore.pending ? <Loader2 className="animate-spin" aria-hidden /> : <ArchiveRestore aria-hidden />}
              {t("contentModel.maintenance.restore")}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}>
              <Archive aria-hidden />
              {t("contentModel.maintenance.archive")}
            </Button>
          )}
          {restore.failure && <ContentFailureNotice failure={restore.failure} />}
        </div>
      )}

      <AssetMaintainerDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        assetName={props.assetName}
        currentMaintainer={props.maintainer}
        candidates={props.candidates}
        onTransfer={props.onTransfer}
      />
      <AssetArchiveDialog open={archiveOpen} onOpenChange={setArchiveOpen} assetName={props.assetName} impact={props.impact} onArchive={props.onArchive} />
    </ContentSection>
  );
}
