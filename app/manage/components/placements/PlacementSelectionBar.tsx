"use client";

import { useMemo, useState } from "react";
import { Archive, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollectionInfo } from "../../lib/content-context";
import { usePlacementStore } from "../../lib/placement-store";
import { PlacementArchiveDialog } from "./PlacementArchiveDialog";
import { usePlacementMap } from "./PlacementMapContext";
import { usePlacementActions } from "./usePlacementActions";

/**
 * Floating bar over the map for a multi-selection: copy into a project and
 * remove (archive) placements. Read-only rows are skipped and said so.
 */
export function PlacementSelectionBar() {
  const { tx, workspaceId, isAll, workspaces, canWrite, canCopy, clearViewerSelection } = usePlacementMap();
  const ids = usePlacementStore((state) => state.selectedPlacementIds);
  const placements = usePlacementStore((state) => state.placements);
  const actions = usePlacementActions();
  const [busy, setBusy] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  // `__all__` is browse-only: copying needs an explicit target project.
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = useCollectionInfo(isAll ? targetId : null);

  const selected = useMemo(() => placements.filter((placement) => ids.includes(placement.id)), [placements, ids]);
  const copyable = isAll ? (target.collection?.capabilities.can_edit ? selected : []) : selected.filter(canCopy);
  const archivable = selected.filter((placement) => canWrite(placement) && placement.status !== "archived");
  const copyTarget = isAll ? targetId : workspaceId;

  if (selected.length === 0) return null;

  const clearAll = () => {
    usePlacementStore.getState().setSelectedPlacementIds([]);
    clearViewerSelection();
  };
  const copy = async () => {
    if (!copyTarget || !copyable.length) return;
    setBusy(true);
    try {
      const result = await actions.copy(copyable, copyTarget);
      if (!result.failed.length) clearAll();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute left-1/2 top-2 z-20 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur">
      <span className="whitespace-nowrap text-sm font-medium">{tx("contentModel.integration.map.selection.count", { count: selected.length })}</span>
      {isAll && (
        <Select value={targetId ?? ""} onValueChange={setTargetId}>
          <SelectTrigger className="h-8 w-40 text-sm" aria-label={tx("contentModel.integration.map.selection.target")}>
            <SelectValue placeholder={tx("contentModel.integration.map.selection.target")} />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {(isAll || copyable.length > 0) && (
        <Button size="sm" variant="secondary" disabled={busy || !copyable.length} onClick={copy}>
          {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {tx(isAll ? "contentModel.integration.map.selection.copyTo" : "contentModel.integration.map.selection.copyHere", { count: copyable.length })}
        </Button>
      )}
      {archivable.length > 0 && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setArchiveOpen(true)}>
          <Archive className="size-4" aria-hidden />
          {tx("contentModel.integration.map.selection.archive", { count: archivable.length })}
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={busy} onClick={clearAll}>
        <X className="size-4" aria-hidden />
        {tx("contentModel.integration.map.action.cancel")}
      </Button>
      <PlacementArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        placements={archivable}
        skippedCount={selected.length - archivable.length}
        onConfirm={() => actions.archive(archivable)}
      />
    </div>
  );
}
