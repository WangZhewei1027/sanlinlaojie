"use client";
import { Button } from "@/components/ui/button";
import { Grid3X3, LocateFixed, Maximize } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { SceneCameraControls } from "./SceneCameraControls";
import type { SceneCameraSettings } from "./three-editor/spatial-reference";

/** Floating tool island; the native transform controls keep their upstream behavior. */
export function SceneSidebar({ nativeToolsRef, grid, onGrid, onFit, onOrigin, cameraSettings, onCameraChange, onPreview }: {
  nativeToolsRef: RefObject<HTMLDivElement | null>; grid: boolean; onGrid: () => void; onFit: () => void;
  onOrigin: () => void; cameraSettings: SceneCameraSettings; onCameraChange: (value: SceneCameraSettings) => void; onPreview: () => void;
}) {
  const { t, i18n } = useTranslation();
  return <section className="scene-tool-island" aria-label={i18n.language.startsWith("zh") ? "舞台工具" : "Stage tools"}>
    <div className="scene-tools-row">
      <div ref={nativeToolsRef} className="scene-three-tools" aria-label={i18n.language.startsWith("zh") ? "空间变换工具" : "Transform tools"} />
      <div className="scene-view-actions flex gap-1">
        <Button size="icon" className="size-8" variant={grid ? "secondary" : "ghost"} title={t("sceneEditor.grid")} aria-label={t("sceneEditor.grid")} aria-pressed={grid} onClick={onGrid}><Grid3X3 /></Button>
        <Button size="icon" className="size-8" variant="ghost" title={`${t("sceneEditor.fit")} (F)`} aria-label={t("sceneEditor.fit")} onClick={onFit}><Maximize /></Button>
        <Button size="icon" className="size-8" variant="ghost" title={i18n.language.startsWith("zh") ? "回到原点" : "Focus origin"} aria-label={i18n.language.startsWith("zh") ? "回到原点" : "Focus origin"} onClick={onOrigin}><LocateFixed /></Button>
        <SceneCameraControls settings={cameraSettings} onChange={onCameraChange} onPreview={onPreview} />
      </div>
    </div>
  </section>;
}
