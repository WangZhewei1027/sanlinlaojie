"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/typography";
import type { CompositionInstance } from "@/lib/scene/protocol";
import { MousePointer2, Trash2 } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SceneNumberField } from "./SceneFields";
import { SceneResourceSource } from "./SceneResourceSource";
import type { ClipInfo, SceneResource } from "./types";

export interface SceneInstancePanelProps {
  instance?: CompositionInstance; resource?: SceneResource; assetHref: string; clips?: ClipInfo[];
  readOnly: boolean; playing: boolean;
  onAnimation: (animation: CompositionInstance["animation"]) => void; onRemove: () => void;
}
export function SceneInstancePanel({ instance, resource, assetHref, clips, readOnly, playing, onAnimation, onRemove }: SceneInstancePanelProps) {
  const { t, i18n } = useTranslation();
  const text = (zh: string, en: string) => i18n.language.startsWith("zh") ? zh : en;
  const id = useId();
  const animation = instance?.animation;
  return <section className="space-y-3 border-t p-3" aria-label={text("所选对象", "Selected object")}>
    <Text as="h2" variant="bodySm" fontWeight="semibold">{text("所选对象", "Selected object")}</Text>
    {!instance ? <div className="flex items-start gap-2 py-1"><MousePointer2 className="mt-1 size-4 shrink-0 text-muted-foreground" /><Text as="p" variant="bodySm" tone="subdued">{text("选择视口中的对象，设置模型动画。", "Select an object in the viewport to set its model animation.")}</Text></div> : <>
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
      {!readOnly && <Button variant="ghost" size="sm" className="w-full justify-start px-0" onClick={onRemove}><Trash2 />{t("sceneEditor.removeInstance")}</Button>}
    </>}
  </section>;
}
