"use client";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActivityDto, ActivityRecordDto } from "@/lib/activities/contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { ContentEmptyState, ContentErrorState, ContentListSkeleton } from "../../content/ContentFeedback";
import { activityApi } from "../../lib/activity-api";
import { useActivityQuery } from "./useActivityQuery";
import { ActivityFailure } from "./ActivityFeedback";

export function ActivityRecords({ activity }: { activity: ActivityDto }) {
  const { t, i18n } = useTranslation();
  const [placementId, setPlacementId] = useState("all");
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const loadPlacements = useCallback((signal: AbortSignal) => activityApi.placements(activity.id, signal), [activity.id]);
  const placements = useActivityQuery(activity.id, loadPlacements);
  const load = useCallback((signal: AbortSignal) => activityApi.records(activity.id, { ...(placementId === "all" ? {} : { placementId }), offset, limit: 25 }, signal), [activity.id, placementId, offset]);
  const records = useActivityQuery(`${activity.id}:${placementId}:${offset}`, load);
  const moderate = async (record: ActivityRecordDto) => {
    setPending(record.id); setError(null);
    try { await activityApi.moderate(record, record.status === "visible" ? "hidden" : "visible"); records.reload(); }
    catch (failure) { setError(failure); } finally { setPending(null); }
  };
  const dateFormat = new Intl.DateTimeFormat(i18n.language.startsWith("en") ? "en" : "zh-CN", { dateStyle: "medium", timeStyle: "short" });
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Text as="h2" variant="headingMd">{t("activities.records")}</Text><Select value={placementId} onValueChange={(value) => { setPlacementId(value); setOffset(0); }}><SelectTrigger className="w-full sm:max-w-sm" aria-label={t("activities.filterPlacement")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("activities.allPlacements")}</SelectItem>{(placements.data ?? []).map((placement) => <SelectItem key={placement.id} value={placement.id}>{placement.workspace_name} · {placement.id.slice(0, 8)}</SelectItem>)}</SelectContent></Select></div><Text as="p" variant="bodySm" tone="subdued">{t("activities.recordsHint")}</Text><ActivityFailure error={error} onReload={() => { setError(null); records.reload(); }} />{records.loading ? <ContentListSkeleton label={t("activities.loading")} /> : records.error ? <ContentErrorState onRetry={records.reload} /> : !records.data?.data.length ? <ContentEmptyState title={t("activities.noRecords")} /> : <div className="space-y-3">{records.data.data.map((record) => <Card key={record.id} className="space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{t(`activities.recordStates.${record.status}`)}</Badge><Text as="span" variant="bodySm" tone="subdued">{placements.data?.find((placement) => placement.id === record.placement_id)?.workspace_name ?? record.placement_id.slice(0, 8)}</Text></div><time dateTime={record.created_at}><Text as="span" variant="bodyXs" tone="subdued">{dateFormat.format(new Date(record.created_at))}</Text></time></div><Text as="p" variant="bodyMd" breakWord>{record.kind === "danmaku" ? record.content : t("activities.checkinRecord", { name: activity.points.find((point) => point.id === record.point_id)?.name ?? t("activities.unknownPoint") })}</Text>{record.location && <Text as="p" variant="bodyXs" tone="subdued">{record.location.longitude.toFixed(6)}, {record.location.latitude.toFixed(6)}</Text>}{record.capabilities.can_edit && <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => moderate(record)}>{t(pending === record.id ? "activities.saving" : record.status === "visible" ? "activities.hideRecord" : "activities.showRecord")}</Button>}</Card>)}</div>}<div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={!offset} onClick={() => setOffset((value) => Math.max(0, value - 25))}>{t("activities.previous")}</Button><Text as="span" variant="bodySm" tone="subdued">{t("activities.recordCount", { count: records.data?.page.total ?? 0 })}</Text><Button variant="outline" disabled={!records.data || offset + 25 >= records.data.page.total} onClick={() => setOffset((value) => value + 25)}>{t("activities.next")}</Button></div></section>;
}
