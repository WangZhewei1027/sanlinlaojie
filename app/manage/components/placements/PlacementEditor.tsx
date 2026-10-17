"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import type { PlacementDto } from "@/lib/content-model/contracts";
import { ContentFailureNotice, ContentNotice } from "@/app/manage/content/ContentFeedback";
import { placementDisplayName } from "../../lib/placement-to-viewer";
import { usePlacementStore } from "../../lib/placement-store";
import { PlacementArchiveDialog } from "./PlacementArchiveDialog";
import { PlacementFieldsForm } from "./PlacementFieldsForm";
import { usePlacementMap } from "./PlacementMapContext";
import { PlacementSourceSection } from "./PlacementSourceSection";
import { usePlacementActions } from "./usePlacementActions";
import { usePlacementForm } from "./usePlacementForm";

/**
 * v2 sidebar editor for one placement: source content (read-only facts and
 * version switch) clearly separated from the placement's own fields.
 * Every control is gated by `capabilities`, never by the org role.
 */
export function PlacementEditor({ placement }: { placement: PlacementDto }) {
  const { t } = useTranslation();
  const { tx, isAll, workspaceId, canWrite, canCopy, workspaceName } = usePlacementMap();
  const form = usePlacementForm(placement);
  const actions = usePlacementActions();
  const [copying, setCopying] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const editable = canWrite(placement);
  const shared = placement.capabilities.read_only_shared;
  const copyable = canCopy(placement) && !!workspaceId;
  const sourceProject = placement.workspace_name ?? workspaceName(placement.workspace_id);

  const copy = async () => {
    if (!workspaceId) return;
    setCopying(true);
    try {
      await actions.copy([placement], workspaceId);
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/20 p-4">
        <div className="min-w-0 flex-1">
          <Text as="h3" variant="bodySm" fontWeight="semibold" truncate>{tx("contentModel.integration.map.editor.title")}</Text>
          <Text as="p" variant="bodyXs" tone="subdued" truncate>
            {placementDisplayName(placement)} · {t(`contentModel.placement.status.${placement.status}`)}
          </Text>
        </div>
        <Button variant="ghost" size="sm" onClick={() => usePlacementStore.getState().selectPlacement(null)} aria-label={tx("contentModel.integration.map.action.close")}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="space-y-3 p-4">
        {shared ? (
          <ContentNotice
            title={tx("contentModel.integration.map.editor.sharedTitle", { project: sourceProject })}
            description={tx("contentModel.integration.map.editor.sharedBody")}
          />
        ) : !editable ? (
          <ContentNotice title={tx(isAll ? "contentModel.integration.map.editor.readOnlyAll" : "contentModel.integration.map.editor.readOnly")} />
        ) : null}

        {form.conflict && (
          <ContentNotice
            tone="warning"
            title={tx("contentModel.integration.map.editor.conflictTitle")}
            description={tx("contentModel.integration.map.editor.conflictBody")}
            action={<Button variant="outline" size="sm" onClick={form.reload}>{tx("contentModel.integration.map.action.reloadPlacement")}</Button>}
          />
        )}
        {form.failure && <ContentFailureNotice failure={form.failure} />}

        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={form.save} disabled={!form.dirty || form.saving}>
              {form.saving && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
              {tx("contentModel.integration.map.action.save")}
            </Button>
            <Button size="sm" variant="outline" onClick={form.discard} disabled={!form.dirty || form.saving}>
              {tx("contentModel.integration.map.action.discard")}
            </Button>
          </div>
        )}

        <PlacementSourceSection placement={placement} editable={editable} formDirty={form.dirty} />
        <PlacementFieldsForm placement={placement} values={form.values} editable={editable} problem={form.problem} onChange={form.update} />

        {(copyable || (editable && placement.status !== "archived")) && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {copyable && (
              <Button size="sm" variant="outline" onClick={copy} disabled={copying}>
                {copying ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {tx(shared ? "contentModel.integration.map.editor.copyShared" : "contentModel.integration.map.editor.copy")}
              </Button>
            )}
            {editable && placement.status !== "archived" && (
              <Button size="sm" variant="outline" onClick={() => setArchiveOpen(true)} disabled={form.saving}>
                <Archive className="size-4" aria-hidden />
                {tx("contentModel.integration.map.editor.archive")}
              </Button>
            )}
          </div>
        )}
      </div>

      <PlacementArchiveDialog open={archiveOpen} onOpenChange={setArchiveOpen} placements={[placement]} onConfirm={() => actions.archive([placement])} />
    </Card>
  );
}
