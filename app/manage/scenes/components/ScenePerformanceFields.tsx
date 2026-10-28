"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/typography";
import { Textarea } from "@/components/ui/textarea";
import type { CompositionInstance } from "@/lib/scene/protocol";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { SceneNumberField, SceneOptionalNumberField } from "./SceneFields";
import { MIN_REGION_DURATION } from "./scene-region";
import { mediaFor, timingFor } from "./scene-performance";

export function SceneTimingFields({ instance, duration, disabled, onChange }: {
  instance: CompositionInstance; duration: number; disabled: boolean; onChange: (patch: Partial<CompositionInstance>) => void;
}) {
  const { i18n } = useTranslation();
  const text = (zh: string, en: string) => i18n.language.startsWith("zh") ? zh : en;
  const timing = timingFor(instance, duration), end = timing.endSeconds ?? duration;
  const change = (patch: Partial<typeof timing>) => {
    const next = { ...timing, ...patch };
    const length = Math.max(0, (next.endSeconds ?? duration) - next.startSeconds);
    next.fadeInSeconds = Math.min(next.fadeInSeconds, length);
    next.fadeOutSeconds = Math.min(next.fadeOutSeconds, length);
    onChange({ timing: next });
  };
  return <section className="scene-inspector-section">
    <Text as="h3" variant="bodySm" fontWeight="semibold">{text("出入场", "Visibility")}</Text>
    <div className="scene-field-grid">
      <label>{text("出现 · 秒", "In · seconds")}<SceneNumberField label={text("出现时间", "Appearance time")} value={timing.startSeconds} min={0} max={Math.max(0, end - MIN_REGION_DURATION)} step={.1} disabled={disabled} onCommit={startSeconds => change({ startSeconds })} /></label>
      <label>{text("消失 · 秒", "Out · seconds")}<SceneNumberField label={text("消失时间", "Disappearance time")} value={end} min={Math.min(600, timing.startSeconds + MIN_REGION_DURATION)} max={600} step={.1} disabled={disabled || timing.startSeconds >= 600} onCommit={endSeconds => change({ endSeconds })} /></label>
      <label>{text("淡入 · 秒", "Fade in · seconds")}<SceneNumberField label={text("淡入时长", "Fade in duration")} value={timing.fadeInSeconds} min={0} max={Math.max(0, end - timing.startSeconds)} disabled={disabled} onCommit={fadeInSeconds => change({ fadeInSeconds })} /></label>
      <label>{text("淡出 · 秒", "Fade out · seconds")}<SceneNumberField label={text("淡出时长", "Fade out duration")} value={timing.fadeOutSeconds} min={0} max={Math.max(0, end - timing.startSeconds)} disabled={disabled} onCommit={fadeOutSeconds => change({ fadeOutSeconds })} /></label>
    </div>
    <Text as="p" variant="bodySm" tone="subdued">{text("拖动时间轴片段两端也可调整出入场。", "Drag either edge of a timeline region to adjust its visibility.")}</Text>
  </section>;
}

export function SceneMediaFields({ instance, disabled, onChange }: {
  instance: CompositionInstance; disabled: boolean; onChange: (patch: Partial<CompositionInstance>) => void;
}) {
  const { i18n } = useTranslation(), id = useId();
  const text = (zh: string, en: string) => i18n.language.startsWith("zh") ? zh : en;
  const media = mediaFor(instance);
  const change = (patch: Partial<typeof media>) => onChange({ media: { ...media, ...patch } });
  return <section className="scene-inspector-section">
    <Text as="h3" variant="bodySm" fontWeight="semibold">{text("媒体播放", "Media playback")}</Text>
    <div className="scene-field-grid">
      <label>{text("源起点 · 秒", "Source in · seconds")}<SceneNumberField label={text("媒体截取起点", "Media trim start")} value={media.trimStartSeconds} min={0} max={Math.max(0, (media.trimEndSeconds ?? 86400) - MIN_REGION_DURATION)} disabled={disabled} onCommit={trimStartSeconds => change({ trimStartSeconds })} /></label>
      <label>{text("源终点 · 秒", "Source out · seconds")}<SceneOptionalNumberField label={text("媒体截取终点", "Media trim end")} value={media.trimEndSeconds} min={Math.min(86400, media.trimStartSeconds + MIN_REGION_DURATION)} max={86400} disabled={disabled || media.trimStartSeconds >= 86400} placeholder={text("文件结尾", "File end")} onCommit={trimEndSeconds => change({ trimEndSeconds })} /></label>
      <label>{text("播放速度", "Playback speed")}<SceneNumberField label={text("播放速度", "Playback speed")} value={media.playbackRate} min={.1} max={4} disabled={disabled} onCommit={playbackRate => change({ playbackRate })} /></label>
      <label>{text("音量 · %", "Volume · %")}<SceneNumberField label={text("音量百分比", "Volume percent")} value={media.volume * 100} min={0} max={100} step={1} disabled={disabled} onCommit={volume => change({ volume: volume / 100 })} /></label>
    </div>
    <div className="flex flex-wrap gap-4"><Label htmlFor={`${id}-loop`} className="flex items-center gap-2"><Checkbox id={`${id}-loop`} checked={media.loop} disabled={disabled} onCheckedChange={checked => change({ loop: checked === true })} />{text("循环片段", "Loop clip")}</Label><Label htmlFor={`${id}-mute`} className="flex items-center gap-2"><Checkbox id={`${id}-mute`} checked={media.muted} disabled={disabled} onCheckedChange={checked => change({ muted: checked === true })} />{text("静音", "Mute")}</Label></div>
  </section>;
}

export function SceneTextFields({ instance, disabled, onChange }: {
  instance: CompositionInstance; disabled: boolean; onChange: (patch: Partial<CompositionInstance>) => void;
}) {
  const { i18n } = useTranslation(), id = useId();
  const text = (zh: string, en: string) => i18n.language.startsWith("zh") ? zh : en;
  const value = instance.text!;
  const [draft, setDraft] = useState(value.content);
  useEffect(() => setDraft(value.content), [value.content]);
  const change = (patch: Partial<typeof value>) => onChange({ text: { ...value, ...patch } });
  return <section className="scene-inspector-section">
    <Label htmlFor={`${id}-content`}>{text("空间文字", "Spatial text")}</Label>
    <Textarea id={`${id}-content`} value={draft} maxLength={4000} rows={3} disabled={disabled} onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft.trim()) change({ content: draft }); else setDraft(value.content); }} />
    <div className="scene-field-grid">
      <label>{text("字号 · 米", "Font size · m")}<SceneNumberField label={text("文字字号", "Text font size")} value={value.fontSize} min={.02} max={5} step={.05} disabled={disabled} onCommit={fontSize => change({ fontSize })} /></label>
      <label>{text("排版宽度 · 米", "Text width · m")}<SceneNumberField label={text("文字宽度", "Text width")} value={value.width} min={.1} max={20} disabled={disabled} onCommit={width => change({ width })} /></label>
      <label>{text("文字颜色", "Text color")}<Input type="color" aria-label={text("文字颜色", "Text color")} value={value.color} disabled={disabled} onChange={event => change({ color: event.target.value })} /></label>
      <label>{text("对齐", "Alignment")}<select className="scene-select w-full" aria-label={text("文字对齐", "Text alignment")} value={value.align} disabled={disabled} onChange={event => change({ align: event.target.value as "left" | "center" | "right" })}><option value="left">{text("左对齐", "Left")}</option><option value="center">{text("居中", "Center")}</option><option value="right">{text("右对齐", "Right")}</option></select></label>
    </div>
    <Text as="p" variant="bodySm" tone="subdued">{text("文字随此场景独立保存，不会添加到团队素材库。", "Text is saved with this scene, separately from the team asset library.")}</Text>
  </section>;
}
