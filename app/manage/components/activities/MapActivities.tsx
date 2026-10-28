"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActivityDto, ActivityPlacementDto } from "@/lib/activities/contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { ContentEmptyState, ContentErrorState, ContentListSkeleton } from "../../content/ContentFeedback";
import { activityApi } from "../../lib/activity-api";
import { teamHref } from "../../lib/content-context";
import { usePlacementStore } from "../../lib/placement-store";
import { usePlacementMap } from "../placements/PlacementMapContext";
import { useActivityQuery } from "./useActivityQuery";
import { ActivityPlacementForm } from "./ActivityPlacementForm";

export function MapActivities() {
  const { workspaceId, organizationId, workspaceCanEdit, workspaces } = usePlacementMap();
  return workspaceId ? <MapActivityList key={`${organizationId}:${workspaceId}`} workspaceId={workspaceId} organizationId={organizationId} canEdit={workspaceCanEdit} workspaces={workspaces} /> : null;
}
function MapActivityList({ workspaceId, organizationId, canEdit, workspaces }: { workspaceId: string; organizationId: string; canEdit: boolean; workspaces: { id: string; name: string }[] }) {
  const { t } = useTranslation();
  const load = useCallback((signal: AbortSignal) => activityApi.collectionPlacements(workspaceId, signal), [workspaceId]);
  const placements = useActivityQuery(workspaceId, load);
  const loadActivities = useCallback((signal: AbortSignal) => activityApi.list(organizationId, signal), [organizationId]);
  const activities = useActivityQuery(organizationId, loadActivities);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const editingId = usePlacementStore((state) => state.selectedActivityPlacementId);
  const [editingSnapshot, setEditingSnapshot] = useState<ActivityPlacementDto | null>(null);
  useEffect(() => {
    if (!editingId) setEditingSnapshot(null);
    else if (editingSnapshot?.id !== editingId) {
      const row = placements.data?.find((placement) => placement.id === editingId);
      if (row) setEditingSnapshot(row);
    }
  }, [editingId, placements.data, editingSnapshot?.id]);
  const editing = editingSnapshot?.id === editingId ? editingSnapshot : null;
  const setEditing = (placement: ActivityPlacementDto | null) => usePlacementStore.getState().selectActivityPlacement(placement?.id ?? null);
  const linkedActivityIds = new Set(placements.data?.map((placement) => placement.activity_id));
  const editableActivities = (activities.data ?? []).filter((activity) => activity.state === "active" && activity.capabilities.can_edit);
  const availableActivities = editableActivities.filter((activity) => !linkedActivityIds.has(activity.id));
  const choicesReady = !activities.loading && !activities.error && !placements.loading && !placements.error;
  const allActivitiesLinked = choicesReady && editableActivities.length > 0 && !availableActivities.length;
  const selected = editing ? activities.data?.find((activity) => activity.id === editing.activity_id) : availableActivities.find((activity) => activity.id === selectedId);
  const close = () => { setCreating(false); setEditing(null); setSelectedId(""); placements.reload(); };
  const collections = workspaces.map((workspace) => ({ ...workspace, capabilities: { can_edit: workspace.id === workspaceId && canEdit } }));

  return <div className="space-y-4 p-3">
    {!creating && !editing && <><Text as="p" variant="bodySm" tone="subdued">{t("activities.mapHint")}</Text><Button variant="outline" asChild className="w-full"><Link href={teamHref("/manage/activities", organizationId)}>{t("activities.manage")}</Link></Button></>}
    {creating || editing ? <div className="space-y-3">
      {!editing && choicesReady && availableActivities.length > 0 && <Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger className="w-full" aria-label={t("activities.chooseActivity")}><SelectValue placeholder={t("activities.chooseActivity")} /></SelectTrigger><SelectContent>{availableActivities.map((activity) => <SelectItem key={activity.id} value={activity.id}>{activity.name}</SelectItem>)}</SelectContent></Select>}
      {activities.loading || placements.loading ? <ContentListSkeleton label={t("activities.loading")} rows={2} />
        : activities.error || placements.error ? <ContentErrorState onRetry={() => { activities.reload(); placements.reload(); }} />
        : selected ? <><ActivityPlacementForm key={editing?.id ?? selected.id} activity={selected} placement={editing ?? undefined} collections={collections} workspaceId={workspaceId} onSaved={close} onCancel={close} /><Button variant="ghost" asChild className="w-full"><Link href={teamHref(`/manage/activities/${selected.id}`, organizationId)}>{t(selected.capabilities.can_edit ? "activities.editContent" : "activities.viewContent")}</Link></Button></>
        : <><Text as="p" variant="bodySm" tone="subdued">{t(allActivitiesLinked ? "activities.allActivitiesLinked" : !availableActivities.length ? "activities.noAvailableActivities" : "activities.chooseActivityHint")}</Text><Button variant="outline" onClick={close}>{t("activities.cancel")}</Button></>}
    </div> : <>
      {canEdit && choicesReady && availableActivities.length > 0 && <Button className="w-full" onClick={() => setCreating(true)}>{t("activities.placeExisting")}</Button>}
      {canEdit && choicesReady && !availableActivities.length && <Text as="p" variant="bodySm" tone="subdued">{t(allActivitiesLinked ? "activities.allActivitiesLinked" : "activities.noAvailableActivities")}</Text>}
      {activities.error && <ContentErrorState onRetry={activities.reload} />}
      {placements.loading ? <ContentListSkeleton label={t("activities.loading")} rows={3} /> : placements.error ? <ContentErrorState onRetry={placements.reload} /> : !placements.data?.length ? <ContentEmptyState title={t("activities.noPlacements")} /> : placements.data.map((placement) => <MapActivityCard key={placement.id} placement={placement} activity={activities.data?.find((activity) => activity.id === placement.activity_id)} onEdit={() => setEditing(placement)} />)}
    </>}
  </div>;
}
function MapActivityCard({ placement, activity, onEdit }: { placement: ActivityPlacementDto; activity?: ActivityDto; onEdit: () => void }) {
  const { t } = useTranslation();
  return <div className="space-y-3 rounded-lg border p-3"><Text as="h3" variant="bodyMd" fontWeight="semibold" breakWord>{placement.activity_name}</Text><div className="flex flex-wrap gap-1"><Badge variant="secondary">{t(`activities.types.${placement.activity_type}`)}</Badge><Badge variant="outline">{t(`activities.placementStates.${placement.status}`)}</Badge></div><Button variant="outline" asChild className="w-full"><Link href={teamHref(`/manage/activities/${placement.activity_id}`, placement.organization_id)}>{t(activity?.capabilities.can_edit ? "activities.editContent" : "activities.viewContent")}</Link></Button><Button variant="outline" className="w-full" disabled={!activity} onClick={onEdit}>{t(placement.capabilities.can_edit ? "activities.editPlacement" : "activities.viewPlacement")}</Button></div>;
}
