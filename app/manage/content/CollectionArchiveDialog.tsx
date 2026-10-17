"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContentFailureNotice } from "./ContentFeedback";
import { useContentAction } from "./useContentAction";
import type { CollectionItem, ContentAction } from "./types";

export interface CollectionArchiveDialogProps {
  collection: CollectionItem | null;
  onOpenChange: (open: boolean) => void;
  onArchive: ContentAction<[collectionId: string]>;
}

/** Archiving is reversible; the dialog states what stops and what is untouched. */
export function CollectionArchiveDialog({ collection, onOpenChange, onArchive }: CollectionArchiveDialogProps) {
  const { t } = useTranslation();
  const action = useContentAction();
  // Keep the last collection so the title stays filled while the dialog animates closed.
  const [shown, setShown] = useState(collection);
  if (collection && collection !== shown) setShown(collection);
  const close = (next: boolean) => {
    if (action.pending) return;
    if (!next) action.reset();
    onOpenChange(next);
  };
  const submit = async () => {
    if (collection && (await action.run(() => onArchive(collection.id)))) close(false);
  };
  return (
    <Dialog open={!!collection} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contentModel.collections.archiveTitle", { name: shown?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("contentModel.collections.archiveBody")}</DialogDescription>
        </DialogHeader>
        {action.failure && <ContentFailureNotice failure={action.failure} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={action.pending}>{t("contentModel.action.cancel")}</Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("contentModel.collections.archive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
