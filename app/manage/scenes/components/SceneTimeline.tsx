"use client";
import { useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Diamond, Maximize2, Pause, Play, Repeat, SkipBack, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { sampleInstance } from '@spatial-memory/scene-core';
import { COMPOSITION_LIMITS, TRANSFORM_CHANNELS, type CompositionInstance, type TransformChannel } from '@/lib/scene/protocol';
import { editChannel, frameAt, removeKey, roundTime, setKey } from '@/lib/scene/transform-authoring';
import { SceneNumberField } from './SceneFields';
import { SceneTimelineRuler } from './SceneTimelineRuler';
import { gridSteps, MIN_SCENE_DURATION, snapTime, TIMELINE_LABEL_WIDTH, TIMELINE_LEAD } from './timeline-scale';
import { useTimelineView } from './useTimelineView';

export interface SceneTimelineProps {
  instance?: CompositionInstance; name?: string; time: number; duration: number; loop: boolean; playing: boolean; readOnly: boolean;
  onSeek(time: number): void; onPlay(): void; onDuration(time: number): void; onLoop(loop: boolean): void;
  onEdit(edit: (instance: CompositionInstance) => CompositionInstance): void;
}
export function SceneTimeline(p: SceneTimelineProps) {
  const { i18n } = useTranslation();
  const text = (zh: string, en: string) => i18n.language.startsWith('zh') ? zh : en;
  const [selected, setSelected] = useState<{ channel: TransformChannel; time: number } | null>(null);
  const [drag, setDrag] = useState<{ channel: TransformChannel; from: number; to: number } | null>(null);
  const dragging = useRef<typeof drag>(null);
  const [endDraft, setEndDraft] = useState<number | null>(null);
  const disabled = p.readOnly || p.playing;
  const end = endDraft ?? p.duration;
  const lastKey = Math.max(0, ...Object.values(p.instance?.tracks ?? {}).map(frames => frames?.at(-1)?.time ?? 0));
  const { scroller, span, laneWidth, zoom, canZoomIn, zoomBy, fit } = useTimelineView(Math.max(end, lastKey), p.time, p.playing);
  const steps = gridSteps(laneWidth / span);
  const x = (time: number) => time / span * laneWidth;
  const left = (time: number) => TIMELINE_LABEL_WIDTH + TIMELINE_LEAD + x(time);
  const pct = (time: number) => `${time / span * 100}%`;
  const values = p.instance ? sampleInstance(p.instance, p.time) : null;
  const labels = { position: text('位置', 'Position'), rotation: text('旋转', 'Rotation'), scale: text('缩放', 'Scale') };
  const currentKey = selected && p.instance?.tracks?.[selected.channel]?.find(f => f.time === selected.time);
  const selectedFrames = selected ? p.instance?.tracks?.[selected.channel] : undefined;
  const nextKey = selectedFrames && currentKey ? selectedFrames[selectedFrames.indexOf(currentKey) + 1] : undefined;
  const interpolation = !currentKey?.connectedRight ? 'hold' : currentKey.handles[2] === currentKey.handles[3] && (!nextKey || nextKey.handles[0] === nextKey.handles[1]) ? 'linear' : currentKey.handles[2] === .42 && currentKey.handles[3] === 0 && (!nextKey || (nextKey.handles[0] === .58 && nextKey.handles[1] === 1)) ? 'ease' : 'custom';

  const onEnd = (time: number | null, commit?: boolean) => {
    if (time !== null) { setEndDraft(time); return; }
    if (commit && endDraft !== null && endDraft !== p.duration) p.onDuration(endDraft);
    setEndDraft(null);
  };
  const laneTime = (event: { clientX: number; altKey: boolean }, lane: HTMLElement, max: number) => {
    const rect = lane.getBoundingClientRect(), raw = Math.max(0, Math.min(max, (event.clientX - rect.left) / rect.width * span));
    return event.altKey ? roundTime(raw) : Math.min(max, snapTime(raw, steps.minor));
  };
  const deleteSelected = () => {
    if (!selected || disabled) return;
    p.onEdit(instance => removeKey(instance, selected.channel, selected.time)); setSelected(null);
  };
  const gridStyle = { gridTemplateColumns: `${TIMELINE_LABEL_WIDTH}px ${laneWidth + TIMELINE_LEAD}px`, '--lead': `${TIMELINE_LEAD}px`, '--major': `${x(steps.major)}px`, '--minor': `${x(steps.minor)}px` } as CSSProperties;
  return <section className="scene-timeline" aria-label={text('变换时间轴', 'Transform timeline')}>
    <div className="scene-timeline-toolbar">
      <Button variant="ghost" size="icon" className="size-8" aria-label={text('回到起点', 'Go to start')} onClick={() => p.onSeek(0)}><SkipBack /></Button>
      <Button variant="secondary" size="icon" className="size-8" aria-label={text(p.playing ? '暂停' : '播放', p.playing ? 'Pause' : 'Play')} onClick={p.onPlay}>{p.playing ? <Pause /> : <Play />}</Button>
      <Button variant="ghost" size="icon" className="size-8 aria-pressed:bg-secondary aria-pressed:text-foreground" aria-label={text('循环播放', 'Loop playback')} aria-pressed={p.loop} disabled={disabled} onClick={() => p.onLoop(!p.loop)}><Repeat /></Button>
      <div className="w-20"><SceneNumberField label={text('播放时间（秒）', 'Time (seconds)')} value={p.time} min={0} max={p.duration} step={.1} onCommit={p.onSeek} /></div>
      <span className="text-xs text-muted-foreground">/</span>
      <div className="w-20"><SceneNumberField label={text('场景时长（秒）', 'Duration (seconds)')} value={end} min={MIN_SCENE_DURATION} max={COMPOSITION_LIMITS.maxDurationSeconds} step={1} disabled={disabled} onCommit={p.onDuration} /></div>
      <span className="text-xs text-muted-foreground">s</span>
      <div className="ml-auto flex items-center gap-1">
        {currentKey && <><select className="scene-select" aria-label={text('关键帧插值', 'Keyframe interpolation')} disabled={disabled} value={interpolation} onChange={e => {
          const mode = e.target.value;
          p.onEdit(instance => {
            const frames = [...instance.tracks![selected!.channel]!];
            const index = frames.findIndex(f => f.time === selected!.time);
            frames[index] = { ...frames[index], connectedRight: mode !== 'hold', handles: [frames[index].handles[0], frames[index].handles[1], mode === 'ease' ? .42 : 2 / 3, mode === 'ease' ? 0 : 2 / 3] };
            if (frames[index + 1]) frames[index + 1] = { ...frames[index + 1], handles: [mode === 'ease' ? .58 : 1 / 3, mode === 'ease' ? 1 : 1 / 3, frames[index + 1].handles[2], frames[index + 1].handles[3]] };
            return { ...instance, tracks: { ...instance.tracks, [selected!.channel]: frames } };
          });
        }}>{interpolation === "custom" && <option value="custom" disabled>{text("原有曲线", "Existing curve")}</option>}<option value="linear">{text('线性', 'Linear')}</option><option value="ease">{text('缓动', 'Ease')}</option><option value="hold">{text('保持', 'Hold')}</option></select><Button variant="ghost" size="icon" className="size-8" disabled={disabled} aria-label={text('删除选中关键帧', 'Delete selected keyframe')} onClick={deleteSelected}><Trash2 /></Button><span className="mx-1 h-5 border-l" aria-hidden="true" /></>}
        <Button variant="ghost" size="icon" className="size-8" aria-label={text('缩小时间轴', 'Zoom out')} disabled={zoom <= 1} onClick={() => zoomBy(1 / 1.5)}><ZoomOut /></Button>
        <Button variant="ghost" size="icon" className="size-8" aria-label={text('放大时间轴', 'Zoom in')} disabled={!canZoomIn} onClick={() => zoomBy(1.5)}><ZoomIn /></Button>
        <Button variant="ghost" size="icon" className="size-8" aria-label={text('适应全部内容', 'Fit to content')} onClick={fit}><Maximize2 /></Button>
      </div>
    </div>
    <div className="scene-timeline-body">
    <div className="scene-timeline-scroll" ref={scroller}>
      <div className="scene-timeline-grid" style={gridStyle}>
        <div className="scene-track-heading"><Text as="span" variant="bodyXs" fontWeight="semibold" className="truncate">{p.name ?? text('未选择对象', 'No object selected')}</Text><span className="text-xs text-muted-foreground">{text('变换', 'Transform')}</span></div>
        <SceneTimelineRuler span={span} end={end} time={p.time} loop={p.loop} steps={steps} canResize={!disabled} text={text} onSeek={p.onSeek} onEnd={onEnd} onDuration={p.onDuration} />
        {p.instance && <>
          <i className="scene-timeline-outside" style={{ left: left(end) }} />
          <i className="scene-end-line" style={{ left: left(end) }} />
          <i className="scene-playhead" style={{ left: left(p.time) }} />
        </>}
        {p.instance && TRANSFORM_CHANNELS.map(channel => {
          const [group, axis] = channel.split('.') as ['position' | 'rotation' | 'scale', 'x' | 'y' | 'z'];
          const value = values![group][axis], factor = group === 'rotation' ? 180 / Math.PI : 1;
          const name = `${labels[group]} ${axis.toUpperCase()}${group === 'rotation' ? ' (°)' : group === 'position' ? ' (m)' : ''}`;
          const keyed = frameAt(p.instance!.tracks?.[channel], p.time) >= 0;
          return <div className="scene-track-row" key={channel}>
            <div className="scene-track-property"><span className="scene-track-label">{name}</span><SceneNumberField label={name} value={value * factor} min={group === 'scale' ? .001 : -100 * factor} max={100 * factor} step={group === 'rotation' ? 1 : .1} disabled={disabled} onCommit={n => p.onEdit(instance => editChannel(instance, channel, p.time, n / factor))} /><Button variant="ghost" size="icon" className="size-7" disabled={disabled} aria-label={text(`${keyed ? '移除' : '添加'} ${name} 关键帧`, `${keyed ? 'Remove' : 'Add'} ${name} keyframe`)} aria-pressed={keyed} onClick={() => p.onEdit(instance => keyed ? removeKey(instance, channel, p.time) : setKey(instance, channel, p.time, value))}><Diamond className={keyed ? 'fill-primary text-primary' : ''} /></Button></div>
            <div className="scene-track-lane" onDoubleClick={e => { if (disabled) return; const at = laneTime(e, e.currentTarget, end); p.onSeek(at); p.onEdit(instance => setKey(instance, channel, at, sampleInstance(instance, at)[group][axis])); }}>
              {p.instance!.tracks?.[channel]?.map(frame => {
                const at = drag?.channel === channel && drag.from === frame.time ? drag.to : frame.time;
                return <button type="button" key={frame.time} className="scene-keyframe" data-outside={at > end || undefined} data-dragging={at !== frame.time || undefined} aria-label={`${name} · ${frame.time}s`} aria-pressed={selected?.channel === channel && selected.time === frame.time} title={`${frame.time}s · ${Number((frame.value * factor).toFixed(3))}`} disabled={disabled} style={{ left: pct(at) }} onClick={() => { setSelected({ channel, time: frame.time }); p.onSeek(Math.min(frame.time, end)); }} onKeyDown={e => {
                  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); p.onEdit(instance => removeKey(instance, channel, frame.time)); setSelected(null); }
                }} onPointerDown={e => { if (e.button) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); dragging.current = { channel, from: frame.time, to: frame.time }; setDrag(dragging.current); }} onPointerMove={e => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId) || !dragging.current) return;
                  dragging.current = { ...dragging.current, to: laneTime(e, e.currentTarget.parentElement!, Math.min(span, COMPOSITION_LIMITS.maxDurationSeconds)) }; setDrag(dragging.current);
                }} onPointerCancel={() => { dragging.current = null; setDrag(null); }} onPointerUp={e => {
                  const move = dragging.current; dragging.current = null; setDrag(null); e.currentTarget.releasePointerCapture(e.pointerId);
                  if (!move || move.from === move.to) return;
                  p.onEdit(instance => {
                    const frames = [...instance.tracks![channel]!];
                    if (frameAt(frames, move.to) >= 0) return instance;
                    const index = frames.findIndex(f => f.time === move.from); frames[index] = { ...frames[index], time: move.to }; frames.sort((a, b) => a.time - b.time);
                    return { ...instance, tracks: { ...instance.tracks, [channel]: frames } };
                  });
                  setSelected({ channel, time: move.to }); p.onSeek(Math.min(move.to, end));
                }}><Diamond aria-hidden="true" /></button>;
              })}
            </div>
          </div>;
        })}
      </div>
    </div>
    {!p.instance && <div className="scene-timeline-empty"><Text as="p" variant="bodySm" tone="subdued" alignment="center">{text('选择视口中的模型，编辑变换或添加关键帧。', 'Select a model in the viewport to edit its transform or add keyframes.')}</Text></div>}
    </div>
  </section>;
}
