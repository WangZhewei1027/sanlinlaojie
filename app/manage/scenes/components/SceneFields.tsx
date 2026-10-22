"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";

/** Commit complete numeric edits on blur/Enter, never transient '-' or empty input. */
export function SceneNumberField({ id, value, onCommit, label, min = -100, max = 100, step = 0.1, disabled = false }: {
  id?: string; value: number; onCommit: (value: number) => void; label: string; min?: number; max?: number; step?: number; disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = String(Number(value.toFixed(3)));
  const finish = () => {
    const number = Number(draft);
    if (draft?.trim() && Number.isFinite(number)) onCommit(Math.min(max, Math.max(min, number)));
    setDraft(null);
  };
  return <Input id={id} aria-label={label} type="number" min={min} max={max} step={step} value={draft ?? display} disabled={disabled} className="h-8 min-w-0 px-2 tabular-nums shadow-none" onChange={(event) => setDraft(event.target.value)} onBlur={finish} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { setDraft(null); event.preventDefault(); }
  }} />;
}
