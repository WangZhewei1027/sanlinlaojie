"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/typography';
import type { CompositionContent } from '@/lib/scene/protocol';
import { findNode, isGroup, trackRows, type SceneNode } from '@/lib/scene/hierarchy-authoring';
import { roundTime, type TransformGroup } from '@/lib/scene/transform-authoring';
import { SceneTimelineRuler } from './SceneTimelineRuler';
import { SceneTimelineToolbar } from './SceneTimelineToolbar';
import { SceneTrack } from './SceneTrack';
import type { DropPlace } from './SceneTrackHeader';
import { unkeyAll } from './SceneKeyLane';
import { interpolationOf, setInterpolation, type KeySelection } from './timeline-keys';
import { TimelineContext, type TimelineView } from './timeline-context';
import { gridSteps, snapTime, TIMELINE_LABEL_WIDTH, TIMELINE_LEAD } from './timeline-scale';
import { useTimelineHeight } from './useTimelineHeight';
import { useTimelineView } from './useTimelineView';
import type { SceneTrackActions } from './useSceneTracks';
import type { ClipInfo } from './types';

export interface SceneTimelineProps {
  content: Pick<CompositionContent, 'instances' | 'groups' | 'assets'>; clips: Record<string, ClipInfo[] | undefined>;
  nameOf(node: SceneNode): string; selectedIds: string[]; onSelect(ids: string[]): void;
  time: number; duration: number; loop: boolean; playing: boolean; readOnly: boolean;
  onSeek(time: number): void; onPlay(): void; onDuration(time: number): void; onLoop(loop: boolean): void;
  tracks: SceneTrackActions;
}
const toggle = <T,>(set: ReadonlySet<T>, value: T) => { const next = new Set(set); if (!next.delete(value)) next.add(value); return next; };

/** Logic-style arrange area: one track per object, groups as stacks, keyframes in lanes revealed under a track. */
export function SceneTimeline(p: SceneTimelineProps) {
  const { i18n } = useTranslation();
  const text = (zh: string, en: string) => i18n.language.startsWith('zh') ? zh : en;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [automation, setAutomation] = useState<ReadonlySet<string>>(new Set());
  const [params, setParams] = useState<ReadonlySet<string>>(new Set());
  const [selectedKey, selectKey] = useState<KeySelection | null>(null);
  const [endDraft, setEndDraft] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const height = useTimelineHeight();
  const disabled = p.readOnly || p.playing, end = endDraft ?? p.duration;
  const rows = useMemo(() => trackRows(p.content), [p.content]);
  const visible = rows.filter(row => { for (let at = row.node.parent; at; at = findNode(p.content, at)?.parent) if (collapsed.has(at)) return false; return true; });
  const lastKey = Math.max(0, ...rows.flatMap(row => Object.values(row.node.tracks ?? {}).map(frames => frames?.at(-1)?.time ?? 0)));
  const { scroller, span, laneWidth, zoom, canZoomIn, zoomBy, fit } = useTimelineView(Math.max(end, lastKey), p.time, p.playing);
  const steps = gridSteps(laneWidth / span), x = (time: number) => time / span * laneWidth, left = (time: number) => TIMELINE_LABEL_WIDTH + TIMELINE_LEAD + x(time);
  const keyNode = selectedKey ? findNode(p.content, selectedKey.nodeId) : undefined;
  const primary = p.selectedIds.at(-1), primaryNode = primary ? findNode(p.content, primary) : undefined;
  const shortcuts = useRef({ automation: () => {}, group: () => {}, ungroup: () => {} });
  shortcuts.current = {
    automation: () => setAutomation(current => p.selectedIds.reduce(toggle, current)),
    group: () => { if (!disabled && p.selectedIds.length) p.tracks.group(); },
    ungroup: () => { if (!disabled && primaryNode && isGroup(primaryNode)) p.tracks.ungroup(primaryNode.id); },
  };
  useEffect(() => {
    // A shows/hides keyframe lanes of the selected tracks; ⌘G / ⇧⌘G stack and unstack them.
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      const key = event.key.toLowerCase(), command = event.metaKey || event.ctrlKey;
      if (key === 'a' && !command) shortcuts.current.automation();
      else if (key === 'g' && command) { event.preventDefault(); shortcuts.current[event.shiftKey ? 'ungroup' : 'group'](); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);

  const view: TimelineView = {
    span, end, time: p.time, steps, disabled, text, selectedKey, selectKey, onSeek: p.onSeek, onEditNode: p.tracks.edit,
    pct: time => `${time / span * 100}%`,
    laneTime: (event, lane, max) => {
      const rect = lane.getBoundingClientRect(), raw = Math.max(0, Math.min(max, (event.clientX - rect.left) / rect.width * span));
      return event.altKey ? roundTime(raw) : Math.min(max, snapTime(raw, steps.minor));
    },
  };
  const select = (event: MouseEvent, id: string) => {
    if (event.metaKey || event.ctrlKey) return p.onSelect(p.selectedIds.includes(id) ? p.selectedIds.filter(item => item !== id) : [...p.selectedIds, id]);
    const from = visible.findIndex(row => row.id === primary), to = visible.findIndex(row => row.id === id);
    if (event.shiftKey && from >= 0) return p.onSelect(visible.slice(Math.min(from, to), Math.max(from, to) + 1).map(row => row.id));
    if (!p.selectedIds.includes(id) || p.selectedIds.length > 1) p.onSelect([id]);
  };
  const drop = (targetId: string, place: DropPlace) => {
    const target = rows.find(row => row.id === targetId);
    if (!dragId || !target || dragId === targetId) return;
    if (place === 'inside') return p.tracks.move(dragId, { parent: targetId });
    if (place === 'before') return p.tracks.move(dragId, { parent: target.node.parent, before: targetId });
    const siblings = rows.filter(row => row.node.parent === target.node.parent && row.id !== dragId);
    p.tracks.move(dragId, { parent: target.node.parent, before: siblings[siblings.indexOf(target) + 1]?.id });
  };
  const gridStyle = { gridTemplateColumns: `${TIMELINE_LABEL_WIDTH}px ${laneWidth + TIMELINE_LEAD}px`, '--lead': `${TIMELINE_LEAD}px`, '--major': `${x(steps.major)}px`, '--minor': `${x(steps.minor)}px` } as CSSProperties;
  return <section className="scene-timeline" style={{ height: height.value }} aria-label={text('时间轴', 'Timeline')}>
    <div className="scene-timeline-resizer" role="separator" aria-orientation="horizontal" aria-label={text('调整时间轴高度', 'Resize timeline')} tabIndex={0} {...height.handlers} />
    <SceneTimelineToolbar text={text} time={p.time} duration={p.duration} end={end} loop={p.loop} playing={p.playing} disabled={disabled}
      onSeek={p.onSeek} onPlay={p.onPlay} onLoop={p.onLoop} onDuration={p.onDuration}
      interpolation={keyNode && selectedKey ? interpolationOf(keyNode, selectedKey) : null}
      onInterpolation={mode => selectedKey && p.tracks.edit(selectedKey.nodeId, node => setInterpolation(node, selectedKey, mode))}
      onDeleteKey={() => { if (selectedKey) p.tracks.edit(selectedKey.nodeId, node => unkeyAll(node, selectedKey.channels, selectedKey.time)); selectKey(null); }}
      canGroup={p.selectedIds.length > 0} canUngroup={!!primaryNode && isGroup(primaryNode)} onGroup={p.tracks.group} onUngroup={() => primary && p.tracks.ungroup(primary)}
      zoom={zoom} canZoomIn={canZoomIn} onZoom={zoomBy} onFit={fit} />
    <div className="scene-timeline-body">
      <div className="scene-timeline-scroll" ref={scroller}>
        <TimelineContext.Provider value={view}>
          <div className="scene-timeline-grid" style={gridStyle}>
            <div className="scene-track-heading"><Text as="span" variant="bodyXs" fontWeight="semibold">{text('轨道', 'Tracks')}</Text><span className="text-xs text-muted-foreground">{p.content.instances.length}</span></div>
            <SceneTimelineRuler span={span} end={end} time={p.time} loop={p.loop} steps={steps} canResize={!disabled} text={text} onSeek={p.onSeek}
              onEnd={(time, commit) => { if (time !== null) return setEndDraft(time); if (commit && endDraft !== null && endDraft !== p.duration) p.onDuration(endDraft); setEndDraft(null); }} onDuration={p.onDuration} />
            {visible.length > 0 && <><i className="scene-timeline-outside" style={{ left: left(end) }} /><i className="scene-end-line" style={{ left: left(end) }} /><i className="scene-playhead" style={{ left: left(p.time) }} /></>}
            {visible.map(row => <SceneTrack key={row.id} row={row} name={p.nameOf(row.node)} clips={p.clips[row.id]} selected={p.selectedIds.includes(row.id)}
              collapsed={collapsed.has(row.id)} automation={automation.has(row.id)} draggable={!p.readOnly}
              expandedParams={new Set((['position', 'rotation', 'scale'] as TransformGroup[]).filter(group => params.has(`${row.id}:${group}`)))}
              onParam={group => setParams(current => toggle(current, `${row.id}:${group}`))}
              onSelect={event => select(event, row.id)} onStack={() => setCollapsed(current => toggle(current, row.id))}
              onAutomation={() => setAutomation(current => toggle(current, row.id))} onRename={name => p.tracks.rename(row.id, name)}
              onDragStart={() => setDragId(row.id)} onDrop={place => { drop(row.id, place); setDragId(null); }}
              onDelete={() => p.tracks.remove(p.selectedIds.includes(row.id) ? p.selectedIds : [row.id])} />)}
          </div>
        </TimelineContext.Provider>
      </div>
      {!rows.length && <div className="scene-timeline-empty"><Text as="p" variant="bodySm" tone="subdued" alignment="center">{text('从素材库添加模型，每个模型会成为这里的一条轨道。', 'Add models from the library; each one becomes a track here.')}</Text></div>}
    </div>
  </section>;
}
