"use client";
import { useEffect, useId, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Text } from "@/components/ui/typography";
import { ContentFailureNotice } from "@/app/manage/content/ContentFeedback";
import { useContentAction } from "@/app/manage/content/useContentAction";
import type { ContentActionResult } from "@/app/manage/content/types";
import type { PlacementDto } from "@/lib/content-model/contracts";
import { organizationApi, workspaceApi } from "../../lib/content-api";
import { ERROR_TEXTS, errorMessage } from "../../lib/content-errors";
import { useIntegrationText, type IntegrationTexts } from "../../lib/integration-text";

const TEXTS: IntegrationTexts = {
  ...ERROR_TEXTS,
  "contentModel.integration.publish.title": ["发布场景", "Publish scene"],
  "contentModel.integration.publish.body": [
    "发布会把当前已保存的草稿固定为发布 #{{number}}。已有投放保持原版本，除非你在下方勾选要一并更新的投放。",
    "Publishing freezes the saved draft as revision #{{number}}. Existing placements keep their revision unless you tick them below.",
  ],
  "contentModel.integration.publish.placements": ["同时更新这些投放", "Also update these placements"],
  "contentModel.integration.publish.noPlacements": ["这个场景还没有投放。发布后可在投放地图中放置。", "This scene has no placements yet. Place it from the map after publishing."],
  "contentModel.integration.publish.placementLine": ["{{project}} · 当前 #{{revision}}", "{{project}} · now #{{revision}}"],
  "contentModel.integration.publish.unnamed": ["未命名投放", "Unnamed placement"],
  "contentModel.integration.publish.noPermission": ["无权修改", "No permission"],
  "contentModel.integration.publish.loadFailed": ["无法读取投放：{{message}}。仍可只发布新版本。", "Could not load placements: {{message}}. You can still publish without updating them."],
  "contentModel.integration.publish.action": ["发布 #{{number}}", "Publish #{{number}}"],
  "contentModel.integration.publish.actionUpdate": ["发布并更新 {{count}} 个投放", "Publish and update {{count}} placements"],
  "contentModel.integration.publish.cancel": ["取消", "Cancel"],
  "contentModel.integration.publish.status.draft": ["草稿", "Draft"],
  "contentModel.integration.publish.status.active": ["启用", "Active"],
  "contentModel.integration.publish.status.paused": ["暂停", "Paused"],
  "contentModel.integration.publish.status.archived": ["已归档", "Archived"],
  "contentModel.integration.publish.refreshed": ["投放已被他人修改，列表已刷新为最新状态。确认勾选后重试。", "Placements changed meanwhile; the list now shows their latest state. Check your selection and try again."],
};

export interface PlacementUpdate { placementId: string; expectedLockVersion: number }

/** Publishing creates a fixed revision; switching placements is an explicit, listed choice. */
export function ScenePublishDialog({ open, onOpenChange, sceneId, organizationId, workspaceId, nextRevisionNo, onPublish }: {
  open: boolean; onOpenChange: (open: boolean) => void; sceneId: string; organizationId: string; workspaceId: string; nextRevisionNo: number;
  /** Each selected placement carries the lock version of the row the user actually saw. */
  onPublish: (updatePlacements: PlacementUpdate[]) => Promise<ContentActionResult>;
}) {
  const tx = useIntegrationText(TEXTS);
  const idPrefix = useId();
  const action = useContentAction();
  const [placements, setPlacements] = useState<PlacementDto[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [reload, setReload] = useState(0);
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected([]); setRefreshed(false); action.reset(); setReload(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- action.reset is stable; reset only when reopened
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setPlacements(null); setLoadError("");
    const ofScene = (list: PlacementDto[]) => list.filter((item) => item.target.kind === "scene_revision" && item.target.scene_id === sceneId && item.status !== "archived");
    // Organization view covers cross-project placements the caller can read; fall back to this project.
    organizationApi.placements(organizationId, abort.signal)
      .catch(() => workspaceApi.placements(workspaceId, undefined, abort.signal))
      .then((list) => {
        const rows = ofScene(list);
        setPlacements(rows);
        // Keep the user's choices that still exist and are still writable after a refresh.
        setSelected((current) => current.filter((placementId) => rows.some((row) => row.id === placementId && row.capabilities.can_edit && !row.capabilities.read_only_shared)));
      })
      .catch((error) => { if (!abort.signal.aborted) { setLoadError(errorMessage(error, tx)); setPlacements([]); } });
    return () => abort.abort();
    // `tx` only formats messages; reloading on its identity would drop fresh lock versions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sceneId, organizationId, workspaceId, reload]);

  const close = (next: boolean) => { if (!action.pending) onOpenChange(next); };
  const submit = async () => {
    const updates = (placements ?? []).filter((row) => selected.includes(row.id)).map((row) => ({ placementId: row.id, expectedLockVersion: row.lock_version }));
    let outcome: ContentActionResult | undefined;
    if (await action.run(async () => (outcome = await onPublish(updates)))) { onOpenChange(false); return; }
    // A stale placement lock: refetch rows so a retry uses the versions now on the server.
    if (outcome && !outcome.ok && outcome.kind === "conflict") { setRefreshed(true); setReload((value) => value + 1); }
  };
  return <Dialog open={open} onOpenChange={close}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{tx("contentModel.integration.publish.title")}</DialogTitle>
        <DialogDescription>{tx("contentModel.integration.publish.body", { number: nextRevisionNo })}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Text as="h3" variant="bodySm" fontWeight="medium">{tx("contentModel.integration.publish.placements")}</Text>
        {placements === null ? <div className="flex justify-center py-3"><LoaderCircle className="size-4 animate-spin text-muted-foreground" /></div>
          : placements.length === 0 ? <Text as="p" variant="bodySm" tone="subdued">{loadError ? tx("contentModel.integration.publish.loadFailed", { message: loadError }) : tx("contentModel.integration.publish.noPlacements")}</Text>
          : <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">{placements.map((placement) => {
            const id = `${idPrefix}-${placement.id}`;
            const revision = placement.target.kind === "scene_revision" ? placement.target.revision_no : 0;
            const editable = placement.capabilities.can_edit && !placement.capabilities.read_only_shared;
            return <li key={placement.id} className="flex items-start gap-3 px-3 py-2">
              <Checkbox id={id} className="mt-0.5" disabled={!editable || action.pending} checked={selected.includes(placement.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...current, placement.id] : current.filter((item) => item !== placement.id))} />
              <label htmlFor={id} className="min-w-0 flex-1 space-y-0.5">
                <Text as="span" variant="bodySm" fontWeight="medium" truncate className="block">{placement.name || tx("contentModel.integration.publish.unnamed")}</Text>
                <Text as="span" variant="bodyXs" tone="subdued" className="block">
                  {tx("contentModel.integration.publish.placementLine", { project: placement.workspace_name ?? placement.workspace_id.slice(0, 8), revision })} · {tx(`contentModel.integration.publish.status.${placement.status}`)}
                  {!editable && ` · ${tx("contentModel.integration.publish.noPermission")}`}
                </Text>
              </label>
            </li>;
          })}</ul>}
      </div>
      {action.failure && <ContentFailureNotice failure={action.failure} />}
      {refreshed && placements !== null && <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.publish.refreshed")}</Text>}
      <DialogFooter>
        <Button variant="outline" onClick={() => close(false)} disabled={action.pending}>{tx("contentModel.integration.publish.cancel")}</Button>
        <Button onClick={submit} disabled={action.pending || placements === null}>
          {action.pending && <LoaderCircle className="animate-spin" />}
          {selected.length ? tx("contentModel.integration.publish.actionUpdate", { count: selected.length }) : tx("contentModel.integration.publish.action", { number: nextRevisionNo })}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
