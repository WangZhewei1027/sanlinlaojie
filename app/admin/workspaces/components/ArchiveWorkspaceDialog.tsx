"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContentFailureNotice } from "@/app/manage/content/ContentFeedback";
import type { ContentActionFailure } from "@/app/manage/content/useContentAction";
import type { IntegrationT } from "@/app/manage/lib/integration-text";

interface ArchiveWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  pending: boolean;
  failure: ContentActionFailure | null;
  onConfirm: () => void;
  tx: IntegrationT;
}

/** Archiving is reversible (admins can restore), so the confirm is not destructive-styled. */
export function ArchiveWorkspaceDialog({ open, onOpenChange, name, pending, failure, onConfirm, tx }: ArchiveWorkspaceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tx("contentModel.integration.members.archive.title", { name })}</DialogTitle>
          <DialogDescription>{tx("contentModel.integration.members.archive.body")}</DialogDescription>
        </DialogHeader>
        {failure && <ContentFailureNotice failure={failure} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {tx("common.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {tx("contentModel.integration.members.archive.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
