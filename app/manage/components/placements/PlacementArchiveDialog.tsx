"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Text } from "@/components/ui/typography";
import type { PlacementDto } from "@/lib/content-model/contracts";
import { placementDisplayName } from "../../lib/placement-to-viewer";
import { usePlacementMap } from "./PlacementMapContext";

interface PlacementArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rows the caller may archive (capability-checked). */
  placements: PlacementDto[];
  /** Selected rows that are read-only and will be left alone. */
  skippedCount?: number;
  onConfirm: () => Promise<unknown>;
}

const LISTED = 5;

/**
 * "移除投放" archives placements only. The dialog states the effect explicitly:
 * the source asset or scene stays in the library and can be placed again.
 */
export function PlacementArchiveDialog({ open, onOpenChange, placements, skippedCount = 0, onConfirm }: PlacementArchiveDialogProps) {
  const { tx } = usePlacementMap();
  const [pending, setPending] = useState(false);
  const close = (next: boolean) => {
    if (!pending) onOpenChange(next);
  };
  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };
  const hidden = placements.length - Math.min(placements.length, LISTED);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tx("contentModel.integration.map.archive.title", { count: placements.length })}</DialogTitle>
          <DialogDescription>{tx("contentModel.integration.map.archive.body")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-md border px-3 py-2.5">
          <ul className="list-disc space-y-0.5 ps-5 text-sm">
            {placements.slice(0, LISTED).map((placement) => <li key={placement.id} className="break-words">{placementDisplayName(placement)}</li>)}
            {hidden > 0 && <li>{tx("contentModel.integration.map.archive.more", { count: hidden })}</li>}
          </ul>
          <Text as="p" variant="bodySm" fontWeight="medium">{tx("contentModel.integration.map.archive.sourceKept")}</Text>
          {skippedCount > 0 && <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.map.archive.skipped", { count: skippedCount })}</Text>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={pending}>{tx("contentModel.integration.map.action.cancel")}</Button>
          <Button onClick={confirm} disabled={pending || placements.length === 0}>
            {pending && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
            {tx("contentModel.integration.map.archive.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
