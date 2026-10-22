"use client";
import type { CSSProperties } from 'react';
import { ChevronRight, Diamond } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sampleInstance } from '@spatial-memory/scene-core';
import type { TransformChannel } from '@/lib/scene/protocol';
import type { SceneNode } from '@/lib/scene/hierarchy-authoring';
import { editChannel, frameAt, type TransformGroup } from '@/lib/scene/transform-authoring';
import { SceneNumberField } from './SceneFields';
import { keyAll, SceneKeyLane, unkeyAll } from './SceneKeyLane';
import { channelsOf, unitFactor } from './timeline-keys';
import { useTimeline } from './timeline-context';

/** Diamond that keys (or unkeys) every listed channel at the playhead. */
function KeyToggle({ node, channels, label }: { node: SceneNode; channels: readonly TransformChannel[]; label: string }) {
  const view = useTimeline();
  const keyed = channels.filter(channel => frameAt(node.tracks?.[channel], view.time) >= 0).length;
  const all = keyed === channels.length;
  return <Button variant="ghost" size="icon" className="size-6 shrink-0" disabled={view.disabled} aria-pressed={all}
    aria-label={view.text(`${all ? '移除' : '添加'}${label}关键帧`, `${all ? 'Remove' : 'Add'} ${label} keyframe`)}
    onClick={() => view.onEditNode(node.id, current => all ? unkeyAll(current, channels, view.time) : keyAll(current, channels, view.time))}>
    <Diamond className={all ? 'fill-primary text-primary' : keyed ? 'text-primary' : ''} />
  </Button>;
}

/**
 * Automation lane for one transform parameter, like a Logic automation lane under its track.
 * The parameter row merges X/Y/Z keys; expanding it shows one lane per axis.
 */
export function SceneParamLane({ node, group, depth, label, expanded, onExpand }: {
  node: SceneNode; group: TransformGroup; depth: number; label: string; expanded: boolean; onExpand(): void;
}) {
  const view = useTimeline();
  const factor = unitFactor(group), values = sampleInstance(node, view.time)[group];
  const unit = group === 'rotation' ? '°' : group === 'position' ? 'm' : '';
  const style = { '--depth': depth } as CSSProperties;
  return <>
    <div className="scene-track-row" data-param>
      <div className="scene-track-property" style={style}>
        <button type="button" className="scene-param-toggle" aria-expanded={expanded} onClick={onExpand}
          aria-label={view.text(`${expanded ? '收起' : '展开'}${label}的 X/Y/Z`, `${expanded ? 'Collapse' : 'Expand'} ${label} axes`)}>
          <ChevronRight aria-hidden="true" /><span className="truncate">{label}</span>{unit && <span className="text-muted-foreground">{unit}</span>}
        </button>
        <div className="scene-param-fields">
          {(['x', 'y', 'z'] as const).map(axis => <SceneNumberField key={axis} label={`${label} ${axis.toUpperCase()}`} value={values[axis] * factor}
            min={group === 'scale' ? .001 : -100 * factor} max={100 * factor} step={group === 'rotation' ? 1 : .1} disabled={view.disabled}
            onCommit={n => view.onEditNode(node.id, current => editChannel(current, `${group}.${axis}`, view.time, n / factor))} />)}
        </div>
        <KeyToggle node={node} channels={channelsOf(group)} label={label} />
      </div>
      <SceneKeyLane node={node} channels={channelsOf(group)} label={label} />
    </div>
    {expanded && channelsOf(group).map(channel => {
      const name = `${label} ${channel.slice(-1).toUpperCase()}`;
      return <div className="scene-track-row" data-param data-axis key={channel}>
        <div className="scene-track-property" style={style}><span className="scene-axis-label">{name}</span><KeyToggle node={node} channels={[channel]} label={name} /></div>
        <SceneKeyLane node={node} channels={[channel]} label={name} />
      </div>;
    })}
  </>;
}
