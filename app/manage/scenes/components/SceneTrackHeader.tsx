"use client";
import { useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from 'react';
import { Box, ChevronRight, Folder, FolderOpen, Spline } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TrackRow } from '@/lib/scene/hierarchy-authoring';
import { useTimeline } from './timeline-context';

export type DropPlace = 'before' | 'after' | 'inside';
export interface SceneTrackHeaderProps {
  row: TrackRow; name: string; selected: boolean; collapsed: boolean; automation: boolean; draggable: boolean;
  onSelect(event: MouseEvent): void; onStack(): void; onAutomation(): void; onRename(name: string): void;
  onDragStart(): void; onDrop(place: DropPlace): void; onDelete(): void;
}
const placeAt = (event: DragEvent<HTMLElement>, group: boolean): DropPlace => {
  const rect = event.currentTarget.getBoundingClientRect(), y = (event.clientY - rect.top) / rect.height;
  return group ? (y < .3 ? 'before' : y > .7 ? 'after' : 'inside') : (y < .5 ? 'before' : 'after');
};

/** Track header: Logic-style name cell where tracks are selected, renamed, reordered and stacked. */
export function SceneTrackHeader(p: SceneTrackHeaderProps) {
  const view = useTimeline();
  const [editing, setEditing] = useState(false);
  // Escape unmounts the field; a blur fired during removal must not commit the draft.
  const cancelled = useRef(false);
  const [drop, setDrop] = useState<DropPlace | null>(null);
  const group = p.row.kind === 'group';
  const Icon = group ? (p.collapsed ? Folder : FolderOpen) : Box;
  const finish = (value: string | null) => {
    if (cancelled.current) return;
    cancelled.current = value === null; setEditing(false);
    if (value !== null && value.trim() !== p.name) p.onRename(value);
  };
  const rename = () => { cancelled.current = false; setEditing(true); };
  return <div className="scene-track-heading-cell" style={{ '--depth': p.row.depth } as CSSProperties} data-selected={p.selected || undefined} data-drop={drop ?? undefined}
    draggable={p.draggable && !editing} tabIndex={0} role="button" aria-pressed={p.selected}
    aria-label={view.text(`${group ? '分组' : '轨道'}：${p.name}`, `${group ? 'Group' : 'Track'}: ${p.name}`)}
    onClick={p.onSelect}
    onKeyDown={e => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter') { e.preventDefault(); if (p.draggable) rename(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && p.draggable) { e.preventDefault(); p.onDelete(); }
    }}
    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.row.id); p.onDragStart(); }}
    onDragOver={e => { if (!p.draggable) return; e.preventDefault(); setDrop(placeAt(e, group)); }}
    onDragLeave={() => setDrop(null)}
    onDrop={e => { e.preventDefault(); setDrop(null); if (p.draggable) p.onDrop(placeAt(e, group)); }}>
    {group ? <button type="button" className="scene-stack-toggle" aria-expanded={!p.collapsed} onClick={e => { e.stopPropagation(); p.onStack(); }}
      aria-label={view.text(p.collapsed ? '展开分组' : '收起分组', p.collapsed ? 'Expand group' : 'Collapse group')}><ChevronRight aria-hidden="true" /></button> : <span className="scene-stack-spacer" />}
    <Icon className="scene-track-icon" aria-hidden="true" />
    {editing ? <Input autoFocus defaultValue={p.name} aria-label={view.text('轨道名称', 'Track name')} className="h-6 min-w-0 flex-1 px-1.5 shadow-none"
      onClick={e => e.stopPropagation()} onBlur={e => finish(e.currentTarget.value)}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') finish(null); }} />
      : <span className="scene-track-name" title={p.name} onDoubleClick={e => { e.stopPropagation(); if (p.draggable) rename(); }}>{p.name}</span>}
    {group && p.collapsed && <span className="scene-track-count">{p.row.children}</span>}
    <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-pressed={p.automation}
      aria-label={view.text(p.automation ? '收起关键帧' : '展开关键帧', p.automation ? 'Hide keyframes' : 'Show keyframes')}
      title={`${view.text('关键帧', 'Keyframes')} (A)`} onClick={e => { e.stopPropagation(); p.onAutomation(); }}><Spline /></Button>
  </div>;
}
