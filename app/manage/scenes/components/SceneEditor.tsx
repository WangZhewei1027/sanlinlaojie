"use client";
/* THESIS: Unity-style docked authoring; one selection, one time, no floating editor stack.
 * OWN-WORLD: incumbent neutral tokens, Geist/PingFang, compact controls and hairline panels.
 * STORY: add a model, select it, pose it, key it, scrub and save the same scene asset.
 * FIRST VIEWPORT: 56px header; 232px hierarchy/library, flexible stage, 284px inspector;
 * 34vh Timeline underneath. Signature: selection and playhead connect all four panes.
 * FORM: user-pinned Unity/Timeline workbench; code-led scoped composition, no new brand.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
 */
import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Maximize, Move3D, Rotate3D, Scaling, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { COMPOSITION_LIMITS, type CompositionInstance, type TransformChannel } from "@/lib/scene/protocol";
import { AXES, deleteKeys, groupChannels, keyTimes, minimumDuration, moveKeys, nearTime, setTransform, type TransformGroup } from "@/lib/scene/editor-document";
import { instanceValues, type TransformValues } from "@/lib/scene/theatre-state";
import { SceneToolbar } from "./SceneToolbar";
import { SceneViewport } from "./SceneViewport";
import { SceneModels } from "./SceneModels";
import { SceneInspector } from "./SceneInspector";
import { SceneDockLayout } from "./SceneDockLayout";
import { SceneModelDropZone } from "./SceneModelDropZone";
import type { PlacementReader, ScenePosition } from "@/lib/scene/editor-interactions";
import { SceneTimeline } from "./SceneTimeline";
import { useSceneDocument } from "./useSceneDocument";
import "./scene-editor.css";

class ViewportBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export default function SceneEditor({ assetId }: { assetId: string }) {
  const { t } = useTranslation();
  const editor = useSceneDocument(assetId);
  const { session, document, models, clips, time, playing, commit } = editor;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<TransformValues>();
  const [preview, setPreview] = useState(false);
  const [record, setRecord] = useState(false);
  const [grid, setGrid] = useState(true);
  const [tool, setTool] = useState<"translate" | "rotate" | "scale">("translate");
  const [mobilePanel, setMobilePanel] = useState("scene");
  const placementRef = useRef<PlacementReader | null>(null);
  const fitRef = useRef<(() => void) | null>(null);
  const instance = document?.definition.content.instances.find((item) => item.id === selectedId);
  useEffect(() => {
    const object = selectedId && session?.objects.get(selectedId);
    if (!object) { setValues(undefined); return; }
    setValues(object.value); return object.onValuesChange(setValues);
  }, [selectedId, session, instance]);
  const actions = useRef(editor); actions.current = editor;
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const input = event.target instanceof HTMLElement && !!event.target.closest("input, textarea, select, [contenteditable=true]");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); event.stopImmediatePropagation(); if (input) (event.target as HTMLElement).blur(); void actions.current.save(); }
      if (input) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") event.stopImmediatePropagation(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.stopImmediatePropagation(); if (event.shiftKey) actions.current.redo(); else actions.current.undo(); }
      if (event.code === "Space" && !(event.target instanceof HTMLElement && event.target.closest("button, [role=slider]"))) { event.preventDefault(); actions.current.play(); }
      if (!event.metaKey && !event.ctrlKey) {
        if (event.key.toLowerCase() === "w") setTool("translate");
        if (event.key.toLowerCase() === "e") setTool("rotate");
        if (event.key.toLowerCase() === "r") setTool("scale");
        if (event.key.toLowerCase() === "f") fitRef.current?.();
        if (event.key === "Escape") setPreview(false);
      }
    };
    window.addEventListener("keydown", shortcut, true); return () => window.removeEventListener("keydown", shortcut, true);
  }, []);
  if (!session || !document) return <main className="fixed inset-0 z-50 flex items-center justify-center bg-background"><div className="max-w-lg space-y-4 p-6"><Text as="h1" variant="headingMd">{t("sceneEditor.heading")}</Text><Text as="p" variant="bodyMd" tone={editor.error ? "critical" : "subdued"}>{editor.error || t("sceneEditor.loading")}</Text>{editor.error && <Button onClick={editor.retry}>{t("sceneEditor.retry")}</Button>}</div></main>;
  const { instances, assets, loop } = document.definition.content;
  const duration = document.definition.content.durationSeconds ?? 10;
  const names = Object.fromEntries(instances.map((item) => {
    const model = models.find((model) => model.id === assets[item.asset]?.assetId);
    const siblings = instances.filter((other) => other.asset === item.asset);
    return [item.id, `${model?.name || t("sceneEditor.unnamedModel")}${siblings.length > 1 ? ` (${siblings.findIndex((other) => other.id === item.id) + 1})` : ""}`];
  }));
  const editInstance = (id: string, edit: (item: CompositionInstance) => CompositionInstance) => commit((current) => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, instances: current.definition.content.instances.map((item) => item.id === id ? edit(item) : item) } } }));
  const addModel = (modelId: string, position: ScenePosition = [0, 0, 0]) => {
    if (instances.length >= COMPOSITION_LIMITS.maxInstances) return;
    const alias = Object.keys(assets).find((key) => assets[key].assetId === modelId) ?? `m${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    if (!assets[alias] && Object.keys(assets).length >= COMPOSITION_LIMITS.maxAssets) { editor.setError(t("sceneEditor.assetLimit")); return; }
    const added: CompositionInstance = { id: `model_${crypto.randomUUID().slice(0, 8)}`, asset: alias, position, quaternion: [0, 0, 0, 1], scale: [1, 1, 1], animation: null };
    commit((current) => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, instances: [...instances, added], assets: { ...assets, [alias]: { assetId: modelId } } } } }));
    setSelectedId(added.id); setMobilePanel("scene");
  };
  const removeModel = () => {
    const remaining = instances.filter((item) => item.id !== selectedId);
    commit((current) => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, instances: remaining, assets: Object.fromEntries(Object.entries(assets).filter(([alias]) => remaining.some((item) => item.asset === alias))) } } }));
    setSelectedId(null);
  };
  const changeTransform = (channel: TransformChannel, value: number) => { if (selectedId) editInstance(selectedId, (item) => setTransform(item, channel, value, time, record)); };
  const toggleKey = (group: TransformGroup) => {
    if (!instance || !values) return;
    editInstance(instance.id, (item) => keyTimes(item, group).some((position) => nearTime(position, time)) ? deleteKeys(item, group, time) : groupChannels(group).reduce((current, channel) => setTransform(current, channel, values[group][channel.split(".")[1] as "x" | "y" | "z"], time, true), item));
  };
  const missing = instances.some((item) => !models.some((model) => model.id === assets[item.asset]?.assetId));
  return <main className="scene-workspace" data-mobile-panel={mobilePanel} data-preview={preview} aria-label={t("sceneEditor.heading")}>
    <h1 className="sr-only">{t("sceneEditor.heading")}</h1>
    <SceneToolbar title={document.title} dirty={editor.dirty} saving={editor.saving} preview={preview} canUndo={editor.canUndo} canRedo={editor.canRedo} onTitle={(title) => commit((current) => ({ ...current, title }))} onPreview={() => { setPreview(!preview); setMobilePanel("scene"); }} onSave={() => void editor.save()} onUndo={editor.undo} onRedo={editor.redo} />
    {(editor.error || missing) && <div role="alert" className="flex shrink-0 items-center gap-3 border-b bg-background px-4 py-2"><Text as="p" variant="bodySm" tone="critical">{editor.error || t("sceneEditor.missingModel")}</Text></div>}
    <nav className="scene-mobile-tabs" aria-label={t("sceneEditor.panels")}>{["scene", "objects", "inspector", "timeline"].map((panel) => <Button key={panel} variant="ghost" size="sm" aria-pressed={mobilePanel === panel} onClick={() => setMobilePanel(panel)}>{t(`sceneEditor.${panel}`)}</Button>)}</nav>
    <SceneDockLayout mobilePanel={mobilePanel} preview={preview} objects={
      <SceneModels models={models} instances={instances} names={names} selectedId={instance?.id ?? null} canAdd={instances.length < COMPOSITION_LIMITS.maxInstances} onAdd={addModel} onSelect={setSelectedId} />} scene={
      <section className="scene-stage" aria-label={t("sceneEditor.sceneView")}>
        <div className="scene-stage-toolbar"><Text as="span" variant="bodyXs" fontWeight="semibold" className="mr-3">{t(preview ? "sceneEditor.preview" : "sceneEditor.scene")}</Text>{!preview && <>{([{ mode: "translate", icon: Move3D, key: "W" }, { mode: "rotate", icon: Rotate3D, key: "E" }, { mode: "scale", icon: Scaling, key: "R" }] as const).map(({ mode, icon: Icon, key }) => <Button key={mode} size="icon" variant={tool === mode ? "secondary" : "ghost"} className="size-7" aria-pressed={tool === mode} aria-label={t(`sceneEditor.${mode}Tool`)} title={`${t(`sceneEditor.${mode}Tool`)} (${key})`} onClick={() => setTool(mode)}><Icon /></Button>)}<div className="mx-2 h-4 border-l" /><Button size="icon" variant={grid ? "secondary" : "ghost"} className="size-7" aria-label={t("sceneEditor.grid")} aria-pressed={grid} title={t("sceneEditor.grid")} onClick={() => setGrid(!grid)}><Grid3X3 /></Button></>}<Button size="icon" variant="ghost" className="ml-auto size-7" aria-label={t("sceneEditor.fit")} title={`${t("sceneEditor.fit")} (F)`} onClick={() => fitRef.current?.()}><Maximize /></Button></div>
        <SceneModelDropZone models={models} enabled={!preview && instances.length < COMPOSITION_LIMITS.maxInstances} placementRef={placementRef} onAdd={addModel}><ViewportBoundary key={instances.map((item) => item.id).join(",")} fallback={<div className="flex items-center justify-center p-6"><Text as="p" variant="bodyMd" tone="critical">{t("sceneEditor.modelFailed")}</Text></div>}><SceneViewport placementRef={placementRef} session={session} instances={instances} models={models} assets={assets} onClips={editor.onClips} fitRef={fitRef} selectedId={preview ? null : instance?.id ?? null} onSelect={setSelectedId} grid={grid && !preview} tool={tool} editable={!playing && !preview} onTransform={(id, next) => editInstance(id, (item) => AXES.reduce((current, axis) => { const group = tool === "translate" ? "position" : tool === "rotate" ? "rotation" : "scale"; return setTransform(current, `${group}.${axis}`, next[group][axis], time, record); }, item))} /></ViewportBoundary>
          {!instances.length && <div className="scene-stage-empty"><Box className="size-9 text-muted-foreground" /><Text as="h2" variant="headingMd">{t("sceneEditor.emptyScene")}</Text><Text as="p" variant="bodyMd" tone="subdued">{t("sceneEditor.emptySceneHint")}</Text>{models[0] && <Button variant="outline" onClick={() => addModel(models[0].id)}>{t("sceneEditor.addFirstModel")}</Button>}</div>}
          {!preview && !!instances.length && <div className="scene-stage-hint"><Text as="span" variant="bodyXs" tone="subdued">{t("sceneEditor.orbitHint")}</Text></div>}
        </SceneModelDropZone>
      </section>} inspector={
      <SceneInspector instance={instance} name={instance && names[instance.id]} values={values ?? (instance && instanceValues(instance))} clips={instance && clips[instance.id]} time={time} duration={duration} record={record} playing={playing} onTransform={changeTransform} onKey={toggleKey} onAnimation={(animation) => { if (instance) editInstance(instance.id, (item) => ({ ...item, animation })); }} onRemove={removeModel} />} timeline={
      <SceneTimeline instances={instances} names={names} clips={clips} selectedId={instance?.id ?? null} time={time} duration={duration} minDuration={minimumDuration(document.definition)} playing={playing} loop={loop} record={record} preview={preview} onSelect={setSelectedId} onSeek={editor.seek} onPlay={editor.play} onLoop={() => commit((current) => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, loop: !loop } } }))} onRecord={() => { session.sheet.sequence.pause(); setRecord(!record); }} onDuration={(durationSeconds) => commit((current) => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, durationSeconds } } }))} onMoveKey={(id, group, from, to) => { editInstance(id, (item) => moveKeys(item, group, from, to)); editor.seek(to); }} onDeleteKey={(id, group, at) => editInstance(id, (item) => deleteKeys(item, group, at))} onMoveClip={(id, startSeconds) => editInstance(id, (item) => ({ ...item, animation: item.animation && { ...item.animation, startSeconds } }))} />} />
    <footer className="scene-status"><Text as="span" variant="bodyXs" tone="subdued">{instance ? names[instance.id] : t("sceneEditor.noSelection")} · {t("sceneEditor.unitsShort")}</Text><Text as="span" variant="bodyXs" tone="subdued">{t("sceneEditor.shortcuts")}</Text></footer>
  </main>;
}
