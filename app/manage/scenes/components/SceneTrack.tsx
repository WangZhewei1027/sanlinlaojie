"use client";
import { useRef, useState } from 'react';
import { TRANSFORM_CHANNELS, type CompositionInstance } from '@/lib/scene/protocol';
import { isGroup, type SceneNode } from '@/lib/scene/hierarchy-authoring';
import { keyTimes, roundTime, type TransformGroup } from '@/lib/scene/transform-authoring';
import { SceneParamLane } from './SceneParamLane';
import { SceneTrackHeader, type SceneTrackHeaderProps } from './SceneTrackHeader';
import { PARAMS } from './timeline-keys';
import { snapTime } from './timeline-scale';
import { useTimeline } from './timeline-context';
import type { ClipInfo } from './types';

/** GLB clip as a region: drag it to move the clip start, like moving a region in Logic. */
function ClipRegion({ instance, clips }: { instance: CompositionInstance; clips?: ClipInfo[] }) {
  const view = useTimeline();
  const animation = instance.animation;
  const [draft, setDraft] = useState<number | null>(null);
  const grab = useRef<{ offset: number } | null>(null);
  const clip = animation && clips?.[animation.clipIndex ?? clips.findIndex(item => item.name === animation.clipName)];
  if (!animation || !clip) return null;
  const start = draft ?? animation.startSeconds;
  const length = animation.loop ? Math.max(0, view.end - start) : Math.min(clip.duration, Math.max(0, view.end - start));
  const repeats = animation.loop && clip.duration > 0 ? Math.min(64, Math.floor(length / clip.duration)) : 0;
  const latest = Math.max(0, view.end - .001);
  const timeAt = (clientX: number, lane: HTMLElement) => { const rect = lane.getBoundingClientRect(); return (clientX - rect.left) / rect.width * view.span; };
  return <div className="scene-clip-region" data-dragging={draft !== null || undefined} aria-disabled={view.disabled}
    style={{ left: view.pct(start), width: view.pct(length) }} title={`${clip.name || 'Clip'} · ${start}s`}
    onPointerDown={e => {
      if (e.button || view.disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      grab.current = { offset: timeAt(e.clientX, e.currentTarget.parentElement!) - start };
    }}
    onPointerMove={e => {
      if (!grab.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const raw = timeAt(e.clientX, e.currentTarget.parentElement!) - grab.current.offset;
      setDraft(Math.min(latest, Math.max(0, e.altKey ? roundTime(raw) : snapTime(raw, view.steps.minor))));
    }}
    onPointerCancel={() => { grab.current = null; setDraft(null); }}
    onPointerUp={() => {
      const next = draft; grab.current = null; setDraft(null);
      if (next !== null && next !== animation.startSeconds) view.onEditNode(instance.id, node => ({ ...node, animation: { ...animation, startSeconds: next } }));
    }}>
    <span className="scene-clip-name">{clip.name || 'Clip'}</span>
    {Array.from({ length: repeats }, (_, i) => <i key={i} className="scene-clip-repeat" style={{ left: `${(i + 1) * clip.duration / length * 100}%` }} />)}
  </div>;
}

export interface SceneTrackProps extends Omit<SceneTrackHeaderProps, 'row'> {
  row: SceneTrackHeaderProps['row']; clips?: ClipInfo[];
  expandedParams: ReadonlySet<TransformGroup>; onParam(group: TransformGroup): void;
}
/** One track: header and region lane, plus parameter lanes while its automation is shown. */
export function SceneTrack({ clips, expandedParams, onParam, ...header }: SceneTrackProps) {
  const view = useTimeline();
  const node: SceneNode = header.row.node;
  const labels = { position: view.text('位置', 'Position'), rotation: view.text('旋转', 'Rotation'), scale: view.text('缩放', 'Scale') };
  return <>
    <div className="scene-track-row" data-kind={header.row.kind} data-selected={header.selected || undefined}>
      <SceneTrackHeader {...header} />
      <div className="scene-track-lane scene-region-lane" onPointerDown={e => { if (!e.button) header.onSelect(e); }}>
        {!isGroup(node) && <ClipRegion instance={node} clips={clips} />}
        {!header.automation && keyTimes(node, TRANSFORM_CHANNELS).map(time => <i key={time} className="scene-key-tick" data-outside={time > view.end || undefined} style={{ left: view.pct(time) }} />)}
      </div>
    </div>
    {header.automation && PARAMS.map(group => <SceneParamLane key={group} node={node} group={group} depth={header.row.depth} label={labels[group]}
      expanded={expandedParams.has(group)} onExpand={() => onParam(group)} />)}
  </>;
}
