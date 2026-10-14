"use client";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { GridItem, type ResizeHandleAxis } from "react-grid-layout";
import { useTranslation } from "react-i18next";
import { sceneDockLayout, type DockSizes } from "@/lib/scene/dock-layout";
import { ScenePanelResizer } from "./ScenePanelResizer";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type Panel = "objects" | "scene" | "inspector" | "timeline";
export function SceneDockLayout({ objects, scene, inspector, timeline, mobilePanel, preview }: {
  objects: ReactNode; scene: ReactNode; inspector: ReactNode; timeline: ReactNode; mobilePanel: string; preview: boolean;
}) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [sizes, setSizes] = useState<DockSizes>({ left: 232, right: 284 });
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setBounds({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) }));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const { width, height } = bounds;
  const mobile = width <= 800;
  const layout = sceneDockLayout(Math.max(801, width), height, sizes);
  const change = (key: keyof DockSizes, value: number) => setSizes((current) => ({ ...current, [key]: value }));
  const panels = { objects, scene, inspector, timeline };
  const handles: Record<Panel, ResizeHandleAxis[]> = { objects: ["e"], scene: [], inspector: ["w"], timeline: ["n"] };
  const setting = (id: Panel) => id === "objects"
    ? { key: "left" as const, label: t("sceneEditor.resizeHierarchy"), value: layout.left, min: 180, max: layout.leftMax }
    : id === "inspector"
      ? { key: "right" as const, label: t("sceneEditor.resizeInspector"), value: layout.right, min: 260, max: layout.rightMax }
      : { key: "bottom" as const, label: t("sceneEditor.resizeTimeline"), value: layout.bottom, min: layout.bottomMin, max: layout.bottomMax };
  return <div ref={container} className="scene-docks" style={{ "--scene-left-width": `${mobile ? 148 : layout.left}px` } as React.CSSProperties}>
    {width > 0 && height > 0 && (Object.keys(panels) as Panel[]).map((id) => {
      const rect = preview ? { x: 0, y: id === "timeline" ? height - 76 : 0, w: width, h: id === "timeline" ? 76 : height - 76 }
        : mobile ? { x: 0, y: 0, w: width, h: height } : layout.panels[id];
      const visible = preview ? id === "scene" || id === "timeline" : !mobile || mobilePanel === id;
      const config = setting(id);
      return <GridItem key={id} i={id} cols={width} containerWidth={width} rowHeight={1} maxRows={height} margin={[0, 0]} containerPadding={[0, 0]}
        {...rect} minW={id === "objects" || id === "inspector" ? config.min : rect.w} maxW={id === "objects" || id === "inspector" ? config.max : rect.w}
        minH={id === "timeline" ? config.min : rect.h} maxH={id === "timeline" ? config.max : rect.h}
        isDraggable={false} isResizable={!mobile && !preview && handles[id].length > 0} isBounded useCSSTransforms={false} resizeHandles={handles[id]}
        resizeHandle={(axis, ref) => <ScenePanelResizer ref={ref as Ref<HTMLDivElement>} className={`scene-resize-${axis}`} label={config.label} value={config.value} min={config.min} max={config.max} vertical={id !== "timeline"} reverse={id !== "objects"} onResize={(value) => change(config.key, value)} />}
        onResizeStart={() => { /* GridItem initializes its resize rectangle through this callback. */ }}
        onResize={(_id, w, h) => change(config.key, id === "timeline" ? h : w)}
        onResizeStop={(_id, w, h) => change(config.key, id === "timeline" ? h : w)}>
        <div className={`scene-dock scene-dock-${id}`} style={{ display: visible ? undefined : "none" }}>{panels[id]}</div>
      </GridItem>;
    })}
  </div>;
}
