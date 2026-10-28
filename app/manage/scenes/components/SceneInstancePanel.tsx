"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/typography";
import { COMPOSITION_LIMITS, type CompositionInstance, type TransformChannel } from "@/lib/scene/protocol";
import { isGroup, type SceneNode } from "@/lib/scene/hierarchy-authoring";
import { sampleInstance } from "@spatial-memory/scene-core";
import { Copy, FolderOutput, MousePointer2, Trash2, X } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SceneNumberField } from "./SceneFields";
import { SceneResourceSource } from "./SceneResourceSource";
import { SceneMediaFields, SceneTextFields, SceneTimingFields } from "./ScenePerformanceFields";
import type { ClipInfo, SceneResource } from "./types";

export interface SceneInstancePanelProps {
  node?: SceneNode; name: string; selectedCount: number; resource?: SceneResource; assetHref: string; clips?: ClipInfo[];
  readOnly: boolean; playing: boolean; time: number; duration: number; canDuplicate: boolean;
  onChange: (patch: Partial<CompositionInstance>) => void;
  onChannel: (channel: TransformChannel, value: number) => void;
  onRename: (name: string) => void; onDuplicate: () => void; onClose: () => void;
  onAnimation: (animation: CompositionInstance["animation"]) => void; onUngroup: () => void; onRemove: () => void;
}
/** The selection inspector owns source, visibility, media/text and spatial parameters. */
export function SceneInstancePanel(props: SceneInstancePanelProps) {
  const { node, name, selectedCount, resource, assetHref, clips, readOnly, playing, onAnimation, onUngroup, onRemove } = props;
  const { t, i18n } = useTranslation();
  const text = (zh: string, en: string) => i18n.language.startsWith("zh") ? zh : en;
  const id = useId();
  const instance = node && !isGroup(node) ? node : undefined;
  const animation = instance?.animation, disabled = readOnly || playing;
  const pose = node ? sampleInstance(node, props.time) : undefined;
  return <section className="scene-inspector" aria-label={text("对象属性", "Object properties")}>
    <div className="scene-panel-heading"><Text as="h2" variant="bodySm" fontWeight="semibold">{text("对象属性", "Inspector")}</Text><Button className="ml-auto size-8" size="icon" variant="ghost" aria-label={text("关闭属性", "Close inspector")} onClick={props.onClose}><X /></Button></div>
    <div className="scene-inspector-content">
    {!node ? <div className="flex items-start gap-2"><MousePointer2 className="mt-1 size-4 shrink-0 text-muted-foreground" /><Text as="p" variant="bodySm" tone="subdued">{text("在舞台或时间轴选择对象，调整空间、出入场和播放参数。", "Select an object on the stage or timeline to edit its position, timing and playback.")}</Text></div> : <>
      <div className="space-y-2"><Label htmlFor={`${id}-name`}>{text("轨道名称", "Track name")}</Label><Input key={`${node.id}-${name}`} id={`${id}-name`} defaultValue={name} maxLength={COMPOSITION_LIMITS.maxNameLength} disabled={disabled} onBlur={event => props.onRename(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /></div>
      {instance?.text ? <SceneTextFields instance={instance} disabled={disabled} onChange={props.onChange} /> : resource && <SceneResourceSource resource={resource} assetHref={assetHref} />}
      {instance && <SceneTimingFields instance={instance} duration={props.duration} disabled={disabled} onChange={props.onChange} />}
      {instance && (resource?.kind === "audio" || resource?.kind === "video") && <SceneMediaFields instance={instance} disabled={disabled} onChange={props.onChange} />}
      {pose && <section className="scene-inspector-section">
        <Text as="h3" variant="bodySm" fontWeight="semibold">{text("空间变换", "Transform")}</Text>
        {(["position", "rotation", "scale"] as const).map(group => <div key={group} className="space-y-1.5"><Text as="span" variant="bodyXs" tone="subdued">{group === "position" ? text("位置 · 米", "Position · m") : group === "rotation" ? text("旋转 · 度", "Rotation · °") : text("缩放", "Scale")}</Text><div className="scene-transform-fields">{(["x", "y", "z"] as const).map(axis => <label key={axis}><span>{axis.toUpperCase()}</span><SceneNumberField label={`${group} ${axis}`} value={pose[group][axis] * (group === "rotation" ? 180 / Math.PI : 1)} min={group === "scale" ? .001 : group === "position" ? -COMPOSITION_LIMITS.maxPositionAbs : -100 * 180 / Math.PI} max={group === "scale" ? COMPOSITION_LIMITS.maxScale : group === "position" ? COMPOSITION_LIMITS.maxPositionAbs : 100 * 180 / Math.PI} disabled={disabled} onCommit={value => props.onChannel(`${group}.${axis}`, value * (group === "rotation" ? Math.PI / 180 : 1))} /></label>)}</div></div>)}
        <Text as="p" variant="bodySm" tone="subdued">{text("已有关键帧的参数会在播放头位置写入一帧。", "Animated parameters receive a keyframe at the playhead.")}</Text>
      </section>}
      {instance && !instance.text && (!resource?.kind || resource.kind === "model") && <section className="scene-inspector-section">
        <Label htmlFor={`${id}-clip`}>{t("sceneEditor.animationClip")}</Label>
        <select id={`${id}-clip`} className="scene-select w-full" disabled={disabled} value={animation ? String(animation.clipIndex ?? clips?.findIndex(clip => clip.name === animation.clipName)) : "none"} onChange={event => onAnimation(event.target.value === "none" ? null : { clipIndex: Number(event.target.value), startSeconds: animation?.startSeconds ?? instance.timing?.startSeconds ?? 0, loop: animation?.loop ?? false })}>
          <option value="none">{t("sceneEditor.noAnimation")}</option>{clips?.map((clip, index) => <option key={index} value={index}>{clip.name || `Clip ${index + 1}`}</option>)}
        </select>
        {animation && <><label className="scene-field-label">{text("动画起点 · 秒", "Animation start · seconds")}<SceneNumberField label={t("sceneEditor.clipStart")} value={animation.startSeconds} min={0} max={600} disabled={disabled} onCommit={startSeconds => onAnimation({ ...animation, startSeconds })} /></label><Label htmlFor={`${id}-loop`} className="flex min-h-8 items-center gap-2"><Checkbox id={`${id}-loop`} disabled={disabled} checked={animation.loop} onCheckedChange={checked => onAnimation({ ...animation, loop: checked === true })} />{t("sceneEditor.clipLoop")}</Label></>}
      </section>}
      {node && isGroup(node) && <Text as="p" variant="bodySm" tone="subdued">{text("分组会带动其中所有对象一起变换。", "A group transforms everything inside it.")}</Text>}
      {!readOnly && <div className="scene-inspector-section flex flex-wrap gap-2">
        {instance && <Button variant="outline" size="sm" disabled={disabled || !props.canDuplicate} onClick={props.onDuplicate}><Copy />{text("复制轨道", "Duplicate")}</Button>}
        {isGroup(node) && <Button variant="outline" size="sm" disabled={disabled} onClick={onUngroup}><FolderOutput />{text("取消编组", "Ungroup")}</Button>}
        <Button variant="ghost" size="sm" disabled={disabled} onClick={onRemove}><Trash2 />{selectedCount > 1 ? text(`删除 ${selectedCount} 条轨道`, `Delete ${selectedCount} tracks`) : text("删除轨道", "Delete track")}</Button>
      </div>}
    </>}
    </div>
  </section>;
}
