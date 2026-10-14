"use client";
import { useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Circle, Diamond, Film, Pause, Play, Repeat2, SkipBack, Timer, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { TRANSFORM_GROUPS, keyTimes, snapTime, type TransformGroup } from "@/lib/scene/editor-document";
import type { CompositionInstance } from "@/lib/scene/protocol";
import { SceneNumberField } from "./SceneFields";
import { SceneAnimationClip } from "./SceneAnimationClip";
import type { ClipInfo } from "./types";

export interface SceneTimelineProps {
  instances: CompositionInstance[]; names: Record<string, string>; clips: Record<string, ClipInfo[]>; selectedId: string | null;
  time: number; duration: number; minDuration: number; playing: boolean; loop: boolean; record: boolean; preview: boolean;
  onSelect: (id: string) => void; onSeek: (time: number) => void; onPlay: () => void; onLoop: () => void; onRecord: () => void;
  onDuration: (duration: number) => void; onMoveKey: (id: string, group: TransformGroup, from: number, to: number) => void;
  onDeleteKey: (id: string, group: TransformGroup, time: number) => void; onMoveClip: (id: string, time: number) => void;
}
function TimelineKey({ time, duration, label, onSeek, onMove, onDelete }: { time: number; duration: number; label: string; onSeek: () => void; onMove: (time: number) => void; onDelete: () => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const target = useRef<number | null>(null);
  const moved = useRef(false);
  const position = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.parentElement!.getBoundingClientRect();
    return Math.min(duration, Math.max(0, snapTime((event.clientX - rect.left) / rect.width * duration)));
  };
  return <button className="scene-key" aria-label={label} title={label} style={{ left: `${(drag ?? time) / duration * 100}%` }} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); target.current = time; moved.current = false; setDrag(time); onSeek(); }} onPointerMove={(event) => { if (target.current !== null) { target.current = position(event); setDrag(target.current); } }} onPointerUp={() => { if (target.current !== null && target.current !== time) { moved.current = true; onMove(target.current); } target.current = null; setDrag(null); }} onPointerCancel={() => { target.current = null; setDrag(null); }} onKeyDown={(event) => {
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); event.stopPropagation(); onDelete(); }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); onMove(Math.min(duration, Math.max(0, snapTime(time + (event.key === "ArrowRight" ? 1 : -1) / 30)))); }
  }} onClick={() => { if (!moved.current) onSeek(); }}><Diamond className="size-3 fill-current" /></button>;
}
export function SceneTimeline(props: SceneTimelineProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState(1);
  const rulerDrag = useRef(false);
  const seekPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    props.onSeek(Math.min(props.duration, Math.max(0, snapTime((event.clientX - rect.left) / rect.width * props.duration))));
  };
  const ticks = Array.from({ length: 11 }, (_, index) => index * props.duration / 10);
  return <section className={`scene-timeline ${props.preview ? "is-preview" : ""}`} aria-label={t("sceneEditor.timeline")}>
    <div className="scene-transport">
      <div className="flex items-center gap-2 pr-3"><Timer className="size-3.5" /><Text as="h2" variant="bodyXs" fontWeight="semibold">{t("sceneEditor.timeline")}</Text></div>
      <Button size="icon" variant="ghost" className="size-8" aria-label={t("sceneEditor.restart")} title={t("sceneEditor.restart")} onClick={() => props.onSeek(0)}><SkipBack /></Button>
      <Button size="icon" variant={props.playing ? "default" : "secondary"} className="size-8" aria-label={t(props.playing ? "sceneEditor.pause" : "sceneEditor.play")} title={`${t(props.playing ? "sceneEditor.pause" : "sceneEditor.play")} (Space)`} onClick={props.onPlay}>{props.playing ? <Pause /> : <Play />}</Button>
      <Button size="icon" variant="ghost" className="size-8" aria-label={t("sceneEditor.loop")} aria-pressed={props.loop} title={t("sceneEditor.loop")} onClick={props.onLoop}><Repeat2 className={props.loop ? "text-foreground" : "text-muted-foreground"} /></Button>
      {!props.preview && <Button size="icon" variant={props.record ? "destructive" : "ghost"} className="size-8" aria-label={t("sceneEditor.record")} aria-pressed={props.record} title={t("sceneEditor.record")} onClick={props.onRecord}><Circle className={props.record ? "fill-current" : ""} /></Button>}
      <div className="scene-time-input"><SceneNumberField value={props.time} label={t("sceneEditor.currentTime")} min={0} max={props.duration} step={1 / 30} onCommit={(time) => props.onSeek(snapTime(time))} /><Text as="span" variant="bodyXs" tone="subdued">/ {props.duration.toFixed(2)} s</Text></div>
      <div className="ml-auto flex items-center gap-2">
        {!props.preview && <><label className="scene-duration-label"><Text as="span" variant="bodyXs" tone="subdued">{t("sceneEditor.duration")}</Text><div className="w-20"><SceneNumberField value={props.duration} label={t("sceneEditor.duration")} min={props.minDuration} max={600} onCommit={props.onDuration} /></div><Text as="span" variant="bodyXs" tone="subdued">s</Text></label><select className="scene-select w-20" aria-label={t("sceneEditor.timelineZoom")} value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>{[1, 2, 4].map((value) => <option key={value} value={value}>{value * 100}%</option>)}</select></>}
      </div>
    </div>
    {props.preview ? <input className="mx-4 mb-3 w-[calc(100%-2rem)] accent-primary" aria-label={t("sceneEditor.seek")} type="range" min={0} max={props.duration} step={1 / 30} value={props.time} onChange={(event) => props.onSeek(Number(event.target.value))} /> : <div className="scene-timeline-scroll">
      <div className="scene-track-sheet" style={{ width: `${zoom * 100}%` }}>
        <div className="scene-track-row scene-ruler-row"><div className="scene-track-label"><Text as="span" variant="bodyXs" tone="subdued">{t("sceneEditor.tracks")}</Text><Text as="span" variant="bodyXs" tone="subdued" className="ml-auto">30 fps</Text></div><div className="scene-ruler" role="slider" tabIndex={0} aria-label={t("sceneEditor.seek")} aria-valuemin={0} aria-valuemax={props.duration} aria-valuenow={props.time} aria-valuetext={`${props.time.toFixed(2)} s`} onPointerDown={(event) => { rulerDrag.current = true; event.currentTarget.setPointerCapture(event.pointerId); seekPointer(event); }} onPointerMove={(event) => { if (rulerDrag.current) seekPointer(event); }} onPointerUp={() => { rulerDrag.current = false; }} onPointerCancel={() => { rulerDrag.current = false; }} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); props.onSeek(event.key === "Home" ? 0 : event.key === "End" ? props.duration : Math.min(props.duration, Math.max(0, snapTime(props.time + (event.key === "ArrowRight" ? 1 : -1) / 30)))); } }}>{ticks.map((tick, index) => <span key={index} className="scene-tick" style={{ left: `${index * 10}%` }}><Text as="span" variant="bodyXs">{Number(tick.toFixed(2))}</Text></span>)}<div className="scene-playhead-head" style={{ left: `${props.time / props.duration * 100}%` }} /></div></div>
        {props.instances.map((instance) => {
          const open = expanded[instance.id] ?? props.selectedId === instance.id;
          const animation = instance.animation;
          const clip = animation?.clipIndex !== undefined ? props.clips[instance.id]?.[animation.clipIndex] : props.clips[instance.id]?.find((item) => item.name === animation?.clipName);
          return <div key={instance.id}>
            <div className="scene-track-row" data-selected={props.selectedId === instance.id}><div className="scene-track-label"><Button size="icon" variant="ghost" className="size-6" aria-expanded={open} aria-label={t("sceneEditor.expandTrack", { name: props.names[instance.id] })} onClick={() => setExpanded({ ...expanded, [instance.id]: !open })}><ChevronRight className={open ? "rotate-90" : ""} /></Button><button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => props.onSelect(instance.id)}><Box className="size-3.5 shrink-0" /><Text as="span" variant="bodyXs" truncate>{props.names[instance.id]}</Text></button></div><div className="scene-track-lane" onClick={() => props.onSelect(instance.id)}>{keyTimes(instance).map((time) => <Diamond key={time} className="scene-summary-key size-2 fill-current" style={{ left: `${time / props.duration * 100}%` }} />)}<div className="scene-playhead" style={{ left: `${props.time / props.duration * 100}%` }} /></div></div>
            {open && TRANSFORM_GROUPS.map((group) => <div className="scene-track-row" key={group}><div className="scene-track-label scene-track-group"><Text as="span" variant="bodyXs" tone="subdued">{t(`sceneEditor.${group}`)}</Text></div><div className="scene-track-lane">{keyTimes(instance, group).map((time) => <TimelineKey key={time} time={time} duration={props.duration} label={`${props.names[instance.id]} · ${t(`sceneEditor.${group}`)} · ${time.toFixed(2)} s`} onSeek={() => { props.onSelect(instance.id); props.onSeek(time); }} onMove={(to) => props.onMoveKey(instance.id, group, time, to)} onDelete={() => props.onDeleteKey(instance.id, group, time)} />)}<div className="scene-playhead" style={{ left: `${props.time / props.duration * 100}%` }} /></div></div>)}
            {animation && <div className="scene-track-row"><div className="scene-track-label scene-track-group"><Film className="size-3 shrink-0" /><Text as="span" variant="bodyXs" tone="subdued">{t("sceneEditor.clip")}</Text></div><div className="scene-track-lane"><SceneAnimationClip animation={animation} clip={clip} duration={props.duration} onSelect={() => props.onSelect(instance.id)} onSeek={props.onSeek} onMove={(start) => props.onMoveClip(instance.id, start)} /><div className="scene-playhead" style={{ left: `${props.time / props.duration * 100}%` }} /></div></div>}
          </div>;
        })}
        {!props.instances.length && <div className="scene-timeline-empty"><Text as="p" variant="bodySm" tone="subdued">{t("sceneEditor.emptyTimeline")}</Text></div>}
      </div>
    </div>}
  </section>;
}
