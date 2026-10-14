"use client";
import { forwardRef, type HTMLAttributes } from "react";

/** Accessible handle; react-grid-layout owns mouse/touch gestures and capture. */
export const ScenePanelResizer = forwardRef<HTMLDivElement, Omit<HTMLAttributes<HTMLDivElement>, "onResize"> & {
  label: string; value: number; min: number; max: number; vertical?: boolean; reverse?: boolean; onResize: (value: number) => void;
}>(function ScenePanelResizer({ label, value, min, max, vertical = true, reverse = false, onResize, className = "", ...events }, ref) {
  const set = (next: number) => onResize(Math.min(max, Math.max(min, next)));
  return <div {...events} ref={ref} className={`react-resizable-handle scene-resizer ${vertical ? "is-vertical" : "is-horizontal"} ${className}`} role="separator" tabIndex={0} aria-label={label} aria-orientation={vertical ? "vertical" : "horizontal"} aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)} onKeyDown={(event) => {
    const increase = vertical ? "ArrowRight" : "ArrowDown";
    const decrease = vertical ? "ArrowLeft" : "ArrowUp";
    if (event.key === increase || event.key === decrease) { event.preventDefault(); set(value + (event.key === increase ? 10 : -10) * (reverse ? -1 : 1)); }
    if (event.key === "Home" || event.key === "End") { event.preventDefault(); set(event.key === "Home" ? min : max); }
  }} />;
});
