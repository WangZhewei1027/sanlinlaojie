"use client";
import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react';

const STORAGE_KEY = 'scene-timeline-height';
const MIN = 140;
const max = () => Math.round(window.innerHeight * .7);
const clamp = (value: number) => Math.round(Math.min(max(), Math.max(MIN, value)));

/** Height of the timeline, dragged from its top edge and remembered per browser. */
export function useTimelineHeight() {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    try { const saved = Number(window.localStorage.getItem(STORAGE_KEY)); if (saved) setHeight(clamp(saved)); } catch { /* storage unavailable */ }
  }, []);
  const commit = (value: number) => {
    const next = clamp(value); setHeight(next);
    try { window.localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* storage unavailable */ }
  };
  return {
    // Unset until the user resizes: the stylesheet default applies, including on narrow screens.
    value: height ?? undefined,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.button) return;
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const section = event.currentTarget.parentElement!.getBoundingClientRect();
        setHeight(clamp(section.bottom - event.clientY));
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) commit(event.currentTarget.parentElement!.getBoundingClientRect().height);
      },
      onKeyDown(event: KeyboardEvent<HTMLElement>) {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        commit(event.currentTarget.parentElement!.getBoundingClientRect().height + (event.key === 'ArrowUp' ? 24 : -24));
      },
    },
  };
}
