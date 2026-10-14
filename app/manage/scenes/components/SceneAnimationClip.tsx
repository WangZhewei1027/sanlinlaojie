"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Film, Repeat2 } from "lucide-react";
import { Text } from "@/components/ui/typography";
import { draggedClipStart } from "@/lib/scene/editor-interactions";
import type { CompositionInstance } from "@/lib/scene/protocol";
import type { ClipInfo } from "./types";

export function SceneAnimationClip({ animation, clip, duration, onSelect, onSeek, onMove }: {
  animation: NonNullable<CompositionInstance["animation"]>; clip?: ClipInfo; duration: number;
  onSelect: () => void; onSeek: (time: number) => void; onMove: (time: number) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<number | null>(null);
  const drag = useRef<{ x: number; start: number; pointer: number; button: HTMLButtonElement; moved: boolean; next: number } | null>(null);
  const suppressClick = useRef(false);
  const cancel = () => {
    const active = drag.current;
    drag.current = null; setDraft(null);
    if (active?.button.hasPointerCapture(active.pointer)) active.button.releasePointerCapture(active.pointer);
  };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && drag.current) { event.preventDefault(); suppressClick.current = true; cancel(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const update = (event: PointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const rect = event.currentTarget.parentElement!.getBoundingClientRect();
    const delta = event.clientX - rect.left - active.x;
    if (!active.moved && Math.abs(delta) < 3) return;
    active.moved = true;
    active.next = draggedClipStart(active.start, delta, rect.width, duration);
    setDraft(active.next);
  };
  const start = draft ?? animation.startSeconds;
  const label = t("sceneEditor.clipAt", { name: clip?.name ?? t("sceneEditor.clip"), time: start.toFixed(2) });
  return <button className="scene-animation-clip" data-dragging={draft !== null || undefined} aria-label={label} title={t("sceneEditor.clipMoveHint")}
    style={{ left: `${start / duration * 100}%`, width: `${Math.max(0, Math.min(animation.loop ? duration : (clip?.duration ?? 1) + start, duration) - start) / duration * 100}%` }}
    onPointerDown={(event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.stopPropagation();
      const rect = event.currentTarget.parentElement!.getBoundingClientRect();
      drag.current = { x: event.clientX - rect.left, start: animation.startSeconds, pointer: event.pointerId, button: event.currentTarget, moved: false, next: animation.startSeconds };
      suppressClick.current = false; event.currentTarget.setPointerCapture(event.pointerId); onSelect(); onSeek(animation.startSeconds);
    }} onPointerMove={update} onPointerUp={(event) => {
      update(event);
      const active = drag.current;
      if (!active) return;
      suppressClick.current = active.moved;
      if (active.moved && active.next !== active.start) { onMove(active.next); onSeek(active.next); }
      cancel();
    }} onPointerCancel={() => { suppressClick.current = true; cancel(); }} onLostPointerCapture={cancel}
    onClick={() => { if (!suppressClick.current) { onSelect(); onSeek(animation.startSeconds); } suppressClick.current = false; }}
    onKeyDown={(event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const next = draggedClipStart(animation.startSeconds, (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 10 : 1), 30 * duration, duration);
        onSelect(); onMove(next); onSeek(next);
      }
    }}>
    <Film className="size-3 shrink-0" /><Text as="span" variant="bodyXs" truncate>{clip?.name || t("sceneEditor.clip")}</Text>{animation.loop && <Repeat2 className="ml-auto size-3 shrink-0" />}
    {draft !== null && <span className="scene-clip-time">{start.toFixed(2)} s</span>}
  </button>;
}
