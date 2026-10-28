"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActivityDto, ActivityPlacementDto } from "@/lib/activities/contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { ContentEmptyState, ContentErrorState, ContentListSkeleton } from "../../content/ContentFeedback";
import { activityApi } from "../../lib/activity-api";
import { useCollections } from "../../lib/collections";
import { ActivityPlacementForm } from "./ActivityPlacementForm";
import { useActivityQuery } from "./useActivityQuery";

export function ActivityPlacements({ activity }: { activity: ActivityDto }) {
  const { t } = useTranslation();
  const load = useCallback((signal: AbortSignal) => activityApi.placements(activity.id, signal), [activity.id]);
  const query = useActivityQuery(activity.id, load);
  const collections = useCollections(activity.organization_id, "all");
  const [editing, setEditing] = useState<ActivityPlacementDto | "new" | null>(null);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (editing) section.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [editing]);
  const close = () => { setEditing(null); query.reload(); };
  const canEdit = activity.capabilities.can_edit && activity.state === "active";
  const linkedMapIds = new Set(query.data?.map((placement) => placement.workspace_id));
  const editableMaps = collections.collections.filter((collection) => collection.capabilities.can_edit);
  const availableMaps = editableMaps.filter((collection) => !linkedMapIds.has(collection.id));
  const choicesReady = !query.loading && !query.error && collections.status === "ready";
  const allMapsLinked = choicesReady && editableMaps.length > 0 && !availableMaps.length;
  const noMapChoices = !availableMaps.length;

  return <section ref={section} className="scroll-mt-20 space-y-4">
    {!editing && <>
      <div className="flex flex-wrap items-center justify-between gap-2"><Text as="h2" variant="headingMd">{t("activities.placements")}</Text>{canEdit && !allMapsLinked && <Button disabled={!choicesReady || noMapChoices} onClick={() => setEditing("new")}>{t("activities.place")}</Button>}</div>
      <Text as="p" variant="bodySm" tone="subdued">{t("activities.placementsHint")}</Text>
      {canEdit && choicesReady && noMapChoices && <Text as="p" variant="bodySm" tone="subdued">{t(allMapsLinked ? "activities.allMapsLinked" : collections.collections.length ? "activities.noEditableMaps" : "activities.noMaps")}</Text>}
      {canEdit && collections.error && <ContentErrorState onRetry={collections.reload} />}
    </>}
    {editing ? collections.status === "loading" || query.loading ? <ContentListSkeleton label={t("activities.loading")} />
      : collections.error || query.error ? <ContentErrorState onRetry={() => { collections.reload(); query.reload(); }} />
      : editing === "new" && noMapChoices ? <ContentEmptyState title={t(allMapsLinked ? "activities.allMapsLinked" : "activities.noMaps")} actions={<Button variant="outline" onClick={close}>{t("activities.cancel")}</Button>} />
      : <div className="border-t pt-4"><ActivityPlacementForm key={editing === "new" ? "new" : editing.id} activity={activity} placement={editing === "new" ? undefined : editing} showHeading={false} collections={editing === "new" ? availableMaps : collections.collections} onSaved={close} onCancel={close} /></div>
      : query.loading ? <ContentListSkeleton label={t("activities.loading")} />
      : query.error ? <ContentErrorState onRetry={query.reload} />
      : !query.data?.length ? <ContentEmptyState title={t("activities.noPlacements")} description={t("activities.noPlacementsHint")} />
      : <div className="space-y-3">{query.data.map((placement) => <Card key={placement.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="space-y-2"><Text as="h3" variant="bodyMd" fontWeight="semibold">{placement.workspace_name}</Text><Badge variant="outline">{t(`activities.placementStates.${placement.status}`)}</Badge></div><div className="flex gap-2"><Button variant="outline" onClick={() => setEditing(placement)}>{t(placement.capabilities.can_edit ? "activities.editPlacement" : "activities.viewPlacement")}</Button></div></Card>)}</div>}
  </section>;
}
