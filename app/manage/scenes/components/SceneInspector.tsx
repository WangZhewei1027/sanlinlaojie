"use client";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { AXES, TRANSFORM_GROUPS, keyTimes, nearTime, type TransformGroup } from "@/lib/scene/editor-document";
import type { CompositionInstance, TransformChannel } from "@/lib/scene/protocol";
import type { TransformValues } from "@/lib/scene/theatre-state";
import { Box, Diamond, Film, SlidersHorizontal, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SceneNumberField } from "./SceneFields";
import type { ClipInfo } from "./types";

export interface SceneInspectorProps {
  instance?: CompositionInstance; name?: string; values?: TransformValues; clips?: ClipInfo[];
  time: number; duration: number; record: boolean; playing: boolean;
  onTransform: (channel: TransformChannel, value: number) => void;
  onKey: (group: TransformGroup) => void; onAnimation: (animation: CompositionInstance["animation"]) => void; onRemove: () => void;
  /** Source facts for the selected object, e.g. its current asset and editor link. */
  source?: ReactNode;
}
export function SceneInspector({ instance, name, values, clips, time, duration, record, playing, onTransform, onKey, onAnimation, onRemove, source }: SceneInspectorProps) {
  const { t } = useTranslation();
  return <aside className="scene-inspector" aria-label={t("sceneEditor.inspector")}>
    <div className="scene-panel-heading"><SlidersHorizontal className="size-3.5" /><Text as="h2" variant="bodyXs" fontWeight="semibold">{t("sceneEditor.inspector")}</Text></div>
    {!instance || !values ? <div className="space-y-4 p-5"><Box className="size-7 text-muted-foreground" /><Text as="h3" variant="bodySm" fontWeight="semibold">{t("sceneEditor.selectObject")}</Text><Text as="p" variant="bodySm" tone="subdued">{t("sceneEditor.inspectorHint")}</Text></div> : <div className="scene-scroll">
      <div className="flex items-center gap-3 border-b px-4 py-4"><Box className="size-6 shrink-0 text-muted-foreground" /><div className="min-w-0"><Text as="h3" variant="bodySm" fontWeight="semibold" truncate title={name}>{name}</Text><Text as="p" variant="bodyXs" tone="subdued">{t("sceneEditor.modelInstance")}</Text></div></div>
      {source && <section className="border-b p-3">{source}</section>}
      <section className="border-b p-3">
        <div className="mb-4 flex items-center justify-between"><Text as="h3" variant="bodyXs" fontWeight="semibold">{t("sceneEditor.transform")}</Text><Text as="span" variant="bodyXs" tone={record ? "critical" : "subdued"}>{record ? t("sceneEditor.recording") : `${time.toFixed(2)} s`}</Text></div>
        <div className="space-y-4">{TRANSFORM_GROUPS.map((group) => {
          const times = keyTimes(instance, group);
          const keyed = times.some((position) => nearTime(position, time));
          return <fieldset key={group} disabled={playing}>
            <div className="mb-1 flex items-center justify-between"><Text as="span" variant="bodyXs" tone="subdued">{t(`sceneEditor.${group}`)}{group === "position" ? " · m" : group === "rotation" ? " · °" : ""}</Text><Button className="size-7" size="icon" variant="ghost" aria-pressed={keyed} aria-label={t(keyed ? "sceneEditor.removeGroupKey" : "sceneEditor.addGroupKey", { group: t(`sceneEditor.${group}`) })} title={t(keyed ? "sceneEditor.removeGroupKey" : "sceneEditor.addGroupKey", { group: t(`sceneEditor.${group}`) })} onClick={() => onKey(group)}><Diamond className={keyed ? "fill-primary" : times.length ? "text-primary" : "text-muted-foreground"} /></Button></div>
            <div className="grid grid-cols-3 gap-2">{AXES.map((axis) => <label className="flex min-w-0 items-center gap-1" key={axis}><Text as="span" variant="bodyXs" tone="subdued">{axis.toUpperCase()}</Text><SceneNumberField label={`${t(`sceneEditor.${group}`)} ${axis.toUpperCase()}`} value={values[group][axis] * (group === "rotation" ? 180 / Math.PI : 1)} min={group === "scale" ? 0.001 : group === "rotation" ? -3600 : -100} max={group === "rotation" ? 3600 : 100} step={group === "rotation" ? 1 : 0.1} onCommit={(value) => onTransform(`${group}.${axis}`, value * (group === "rotation" ? Math.PI / 180 : 1))} /></label>)}</div>
          </fieldset>;
        })}</div>
        <Text as="p" variant="bodySm" tone="subdued" className="mt-4">{t(record ? "sceneEditor.recordHint" : "sceneEditor.transformHint")}</Text>
      </section>
      <section className="space-y-3 border-b p-3">
        <div className="flex items-center gap-2"><Film className="size-3.5" /><Text as="h3" variant="bodyXs" fontWeight="semibold">{t("sceneEditor.animationClip")}</Text></div>
        {!clips ? <Text as="p" variant="bodySm" tone="subdued">{t("sceneEditor.loadingModel")}</Text> : !clips.length ? <Text as="p" variant="bodySm" tone="subdued">{t("sceneEditor.noClips")}</Text> : <>
          <label className="block"><Text as="span" variant="bodyXs" tone="subdued">{t("sceneEditor.clip")}</Text><select className="scene-select mt-1 w-full" aria-label={t("sceneEditor.clip")} disabled={playing} value={instance.animation ? String(instance.animation.clipIndex ?? clips.findIndex((clip) => clip.name === instance.animation?.clipName)) : "none"} onChange={(event) => onAnimation(event.target.value === "none" ? null : { clipIndex: Number(event.target.value), startSeconds: instance.animation?.startSeconds ?? 0, loop: instance.animation?.loop ?? false })}><option value="none">{t("sceneEditor.noAnimation")}</option>{clips.map((clip, index) => <option key={index} value={index}>{clip.name || `${t("sceneEditor.clip")} ${index + 1}`} · {clip.duration.toFixed(2)} s</option>)}</select></label>
          {instance.animation && <><label className="flex items-center justify-between gap-4"><Text as="span" variant="bodyXs" tone="subdued">{t("sceneEditor.clipStart")} (s)</Text><div className="w-24"><SceneNumberField label={t("sceneEditor.clipStart")} value={instance.animation.startSeconds} min={0} max={duration} disabled={playing} onCommit={(startSeconds) => onAnimation({ ...instance.animation!, startSeconds })} /></div></label><label className="flex items-center gap-2"><input type="checkbox" checked={instance.animation.loop} disabled={playing} onChange={(event) => onAnimation({ ...instance.animation!, loop: event.target.checked })} /><Text as="span" variant="bodySm">{t("sceneEditor.clipLoop")}</Text></label></>}
        </>}
      </section>
      <div className="p-3"><Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}><Trash2 />{t("sceneEditor.removeInstance")}</Button></div>
    </div>}
  </aside>;
}
