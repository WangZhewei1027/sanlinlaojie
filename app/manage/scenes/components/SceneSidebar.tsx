"use client";
import { Button } from "@/components/ui/button";
import { Grid3X3, Maximize } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";

/** Floating tool island; the native transform controls keep their upstream behavior. */
export function SceneSidebar({ nativeToolsRef, grid, onGrid, onFit }: {
  nativeToolsRef: RefObject<HTMLDivElement | null>; grid: boolean; onGrid: () => void; onFit: () => void;
}) {
  const { t, i18n } = useTranslation();
  return <section className="scene-tool-island" aria-label={i18n.language.startsWith("zh") ? "舞台工具" : "Stage tools"}>
    <div className="scene-tools-row">
      <div ref={nativeToolsRef} className="scene-three-tools" aria-label={i18n.language.startsWith("zh") ? "空间变换工具" : "Transform tools"} />
      <div className="scene-view-actions flex gap-1">
        <Button size="icon" className="size-8" variant={grid ? "secondary" : "ghost"} title={t("sceneEditor.grid")} aria-label={t("sceneEditor.grid")} aria-pressed={grid} onClick={onGrid}><Grid3X3 /></Button>
        <Button size="icon" className="size-8" variant="ghost" title={`${t("sceneEditor.fit")} (F)`} aria-label={t("sceneEditor.fit")} onClick={onFit}><Maximize /></Button>
      </div>
    </div>
  </section>;
}
