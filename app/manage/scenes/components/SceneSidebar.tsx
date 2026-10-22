"use client";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ChevronDown, CircleHelp, Grid3X3, Maximize } from "lucide-react";
import { type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";

export interface SceneSidebarProps {
  children: ReactNode; nativeToolsRef: RefObject<HTMLDivElement | null>;
  grid: boolean; onGrid: () => void; onFit: () => void;
  time: number; playing: boolean; loop: boolean; readOnly: boolean; compact: boolean;
  onPlay: () => void; onLoop: (loop: boolean) => void;
}
export function SceneSidebar(props: SceneSidebarProps) {
  const { t, i18n } = useTranslation();
  const text = (zh: string, en: string) => i18n.language.startsWith("zh") ? zh : en;
  return <div className="scene-sidebar">
    <section className="space-y-2 border-b p-3" aria-label={text("视口工具", "Viewport tools")}>
      <Text as="h2" variant="bodySm" fontWeight="semibold">{text("视口工具", "Viewport tools")}</Text>
      <div className="scene-tools-row">
        <div ref={props.nativeToolsRef} className="scene-three-tools" aria-label="Three.js Editor tools" />
        <div className="scene-view-actions flex gap-1">
          <Button size="icon" className="size-8" variant={props.grid ? "secondary" : "ghost"} title={t("sceneEditor.grid")} aria-label={t("sceneEditor.grid")} aria-pressed={props.grid} onClick={props.onGrid}><Grid3X3 /></Button>
          <Button size="icon" className="size-8" variant="ghost" title={`${t("sceneEditor.fit")} (F)`} aria-label={t("sceneEditor.fit")} onClick={props.onFit}><Maximize /></Button>
        </div>
      </div>
    </section>
    <div className="scene-sidebar-content">
      {props.children}
      <details className="scene-editor-help border-t px-3 py-2">
        <summary className="flex cursor-pointer items-center gap-2 rounded-sm py-2 text-sm text-muted-foreground"><CircleHelp className="size-4" />{text("编排帮助", "Editor help")}<ChevronDown className="ml-auto size-4" /></summary>
        <div className="space-y-3 pb-2 pt-1">
          {!props.readOnly && <Text as="p" variant="bodySm" tone="subdued">{text("每个对象是时间轴上的一条轨道。点曲线按钮展开位置、旋转、缩放的关键帧；拖动轨道名称排序，拖到分组上即可放入分组。", "Each object is a timeline track. Use the curve button to show its position, rotation and scale keys; drag a track name to reorder it or drop it on a group.")}</Text>}
          <Text as="p" variant="bodySm" tone="subdued">{text("素材修改会同步更新地图和场景中的引用。", "Asset edits update their references in maps and scenes.")}</Text>
          <dl className="grid grid-cols-2 gap-y-2 text-xs text-muted-foreground">
            <dt>{text("移动 / 旋转 / 缩放", "Move / Rotate / Scale")}</dt><dd className="text-right">W / E / R</dd>
            <dt>{text("聚焦对象", "Focus selection")}</dt><dd className="text-right">F</dd>
            <dt>{text("显示关键帧", "Show keyframes")}</dt><dd className="text-right">A</dd>
            <dt>{text("编组 / 取消编组", "Group / Ungroup")}</dt><dd className="text-right">⌘ G / ⇧⌘ G</dd>
            <dt>{text("保存", "Save")}</dt><dd className="text-right">Ctrl / ⌘ S</dd>
          </dl>
        </div>
      </details>

    </div>

  </div>;
}
