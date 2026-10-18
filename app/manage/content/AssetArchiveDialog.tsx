"use client";

import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Text } from "@/components/ui/typography";
import { ContentFailureNotice } from "./ContentFeedback";
import { useContentAction } from "./useContentAction";
import type { AssetUsageKind, ContentAction } from "./types";

export interface AssetArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetName: string;
  /** Dependency counts by kind, restricted ones included. */
  impact: Record<AssetUsageKind, number>;
  onArchive: ContentAction;
}

/** Archiving is reversible: it lists what keeps working and what stops. */
export function AssetArchiveDialog({ open, onOpenChange, assetName, impact, onArchive }: AssetArchiveDialogProps) {
  const { t } = useTranslation();
  const action = useContentAction();
  const close = (next: boolean) => {
    if (action.pending) return;
    if (!next) action.reset();
    onOpenChange(next);
  };
  const submit = async () => {
    if (await action.run(onArchive)) close(false);
  };
  const lines = (["scene", "placement"] as const).filter((kind) => impact[kind] > 0);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contentModel.maintenance.archiveTitle", { name: assetName })}</DialogTitle>
          <DialogDescription>{t("contentModel.maintenance.archiveBody")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-md border px-3 py-2.5">
          <Text as="p" variant="bodySm" fontWeight="medium">{t("contentModel.maintenance.keepsWorking")}</Text>
          {lines.length ? (
            <ul className="list-disc space-y-0.5 ps-5 text-sm">
              {lines.map((kind) => <li key={kind}>{t(`contentModel.maintenance.impact.${kind}`, { count: impact[kind] })}</li>)}
            </ul>
          ) : (
            <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.maintenance.noImpact")}</Text>
          )}
          <Text as="p" variant="bodySm" fontWeight="medium" className="pt-1">{t("contentModel.maintenance.stops")}</Text>
          <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.maintenance.stopsBody")}</Text>
        </div>
        {action.failure && <ContentFailureNotice failure={action.failure} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={action.pending}>{t("contentModel.action.cancel")}</Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("contentModel.maintenance.archiveAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
