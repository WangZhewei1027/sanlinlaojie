"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/typography";
import type { CompositionInstance } from "@/lib/scene/protocol";
import { isGroup, type SceneNode } from "@/lib/scene/hierarchy-authoring";
import { FolderOutput, MousePointer2, Trash2 } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SceneNumberField } from "./SceneFields";
import { SceneResourceSource } from "./SceneResourceSource";
import type { ClipInfo, SceneResource } from "./types";

export interface SceneInstancePanelProps {
  node?: SceneNode; name: string; selectedCount: number; resource?: SceneResource; assetHref: string; clips?: ClipInfo[];
  readOnly: boolean; playing: boolean;
  onAnimation: (animation: CompositionInstance["animation"]) => void; onUngroup: () => void; onRemove: () => void;
}
/** Inspector for the selected track: asset source and GLB clip, or group actions. Tracks are listed in the timeline. */
export function SceneInstancePanel({ node, name, selectedCount, resource, assetHref, clips, readOnly, playing, onAnimation, onUngroup, onRemove }: SceneInstancePanelProps) {
  const { t, i18n } = useTranslation();
  const text = (zh: string, en: string) => i18n.language.startsWith("zh") ? zh : en;
  const id = useId();
  const instance = node && !isGroup(node) ? node : undefined;
  const animation = instance?.animation;
  const remove = !readOnly && <Button variant="ghost" size="sm" className="w-full justify-start px-0" onClick={onRemove}><Trash2 />{selectedCount > 1 ? text(`删除 ${selectedCount} 条轨道`, `Delete ${selectedCount} tracks`) : node && isGroup(node) ? text("删除分组及其内容", "Delete group and contents") : t("sceneEditor.removeInstance")}</Button>;
  return <section className="space-y-3 border-t p-3" aria-label={text("所选对象", "Selected object")}>
    <Text as="h2" variant="bodySm" fontWeight="semibold">{text("所选对象", "Selected object")}</Text>
    {!node ? <div className="flex items-start gap-2 py-1"><MousePointer2 className="mt-1 size-4 shrink-0 text-muted-foreground" /><Text as="p" variant="bodySm" tone="subdued">{text("在视口或时间轴轨道上选择对象。", "Select an object in the viewport or a timeline track.")}</Text></div> : !instance ? <>
      <Text as="p" variant="bodySm" breakWord>{name}</Text>
      <Text as="p" variant="bodySm" tone="subdued">{text("分组会带动其中所有对象一起变换；在时间轴展开分组轨道可为它添加关键帧。", "A group transforms everything inside it. Show its keyframe lanes in the timeline to animate it.")}</Text>
      {!readOnly && <Button variant="ghost" size="sm" className="w-full justify-start px-0" disabled={playing} onClick={onUngroup}><FolderOutput />{text("取消编组", "Ungroup")}</Button>}
      {remove}
    </> : <>
      {resource ? <SceneResourceSource resource={resource} assetHref={assetHref} /> : <Text as="p" variant="bodySm" breakWord>{instance.id}</Text>}
      <div className="space-y-2"><Label htmlFor={`${id}-clip`}>{t("sceneEditor.animationClip")}</Label>
        <select id={`${id}-clip`} className="scene-select w-full" disabled={readOnly || playing} value={animation ? String(animation.clipIndex ?? clips?.findIndex((clip) => clip.name === animation.clipName)) : "none"} onChange={(event) => onAnimation(event.target.value === "none" ? null : { clipIndex: Number(event.target.value), startSeconds: animation?.startSeconds ?? 0, loop: animation?.loop ?? false })}>
          <option value="none">{t("sceneEditor.noAnimation")}</option>{clips?.map((clip, index) => <option key={index} value={index}>{clip.name || `Clip ${index + 1}`}</option>)}
        </select>
      </div>
      {animation && <>
        <div className="grid grid-cols-2 items-center gap-3"><Label htmlFor={`${id}-start`}>{t("sceneEditor.clipStart")} <span className="text-muted-foreground">(s)</span></Label><SceneNumberField id={`${id}-start`} label={t("sceneEditor.clipStart")} value={animation.startSeconds} min={0} max={600} disabled={readOnly || playing} onCommit={(startSeconds) => onAnimation({ ...animation, startSeconds })} /></div>
        <Label htmlFor={`${id}-loop`} className="flex min-h-8 items-center gap-2"><Checkbox id={`${id}-loop`} disabled={readOnly || playing} checked={animation.loop} onCheckedChange={(checked) => onAnimation({ ...animation, loop: checked === true })} />{t("sceneEditor.clipLoop")}</Label>
      </>}
      {remove}
    </>}
  </section>;
}
