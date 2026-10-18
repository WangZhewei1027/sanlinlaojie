"use client";
/* THESIS: Unity-style docked authoring; one selection, one time, no floating editor stack.
 * OWN-WORLD: incumbent neutral tokens, Geist/PingFang, compact controls and hairline panels.
 * STORY: add a model, select it, pose it, key it, scrub and save the same scene asset.
 * FIRST VIEWPORT: 56px header; 232px hierarchy/library, flexible stage, 284px inspector;
 * 34vh Timeline underneath. Signature: selection and playhead connect all four panes.
 * FORM: user-pinned Unity/Timeline workbench; code-led scoped composition, no new brand.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
 */
import { SceneQrButton } from "@/components/scene-qr-button";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import { ContentStatusBadge } from "@/app/manage/content/ContentStatusBadge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import type { SceneDetailDto } from "@/lib/content-model/contracts";
import { AXES, deleteKeys, groupChannels, keyTimes, minimumDuration, moveKeys, nearTime, setTransform, type TransformGroup } from "@/lib/scene/editor-document";
import type { PlacementReader, ScenePosition } from "@/lib/scene/editor-interactions";
import { COMPOSITION_LIMITS, type CompositionInstance, type TransformChannel } from "@/lib/scene/protocol";
import { instanceValues, type TransformValues } from "@/lib/scene/theatre-state";
import { Box, Grid3X3, Maximize, Move3D, Rotate3D, Scaling } from "lucide-react";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { teamHref } from "../../lib/content-context";
import { ERROR_TEXTS } from "../../lib/content-errors";
import { useIntegrationText, type IntegrationTexts } from "../../lib/integration-text";
import { addModelInstance, type ModelAddFailure } from "./scene-add-model";
import "./scene-editor.css";
import { SceneConflictBanner } from "./SceneConflictBanner";
import { SceneDockLayout } from "./SceneDockLayout";
import { SceneInspector } from "./SceneInspector";
import { SceneLibraryPanel } from "./SceneLibraryPanel";
import { SceneModelDropZone } from "./SceneModelDropZone";
import { SceneModels } from "./SceneModels";
import { SceneResourceSource } from "./SceneResourceSource";
import { SceneTimeline } from "./SceneTimeline";
import { SceneToolbar } from "./SceneToolbar";
import { SceneViewport } from "./SceneViewport";
import type { SceneResource } from "./types";
import { useSceneDocument } from "./useSceneDocument";

const TEXTS: IntegrationTexts = {
  ...ERROR_TEXTS,
  "contentModel.integration.sceneEditor.readOnlyTitle": ["只读", "Read-only"],
  "contentModel.integration.sceneEditor.readOnlyBody": ["你在这个团队中只能查看，可以预览和播放，但不能修改。", "You can only view in this team. You can preview and play, but not change anything."],
  "contentModel.integration.sceneEditor.archivedTitle": ["场景已归档", "Scene archived"],
  "contentModel.integration.sceneEditor.archivedBody": ["已有投放继续使用保存的场景。恢复场景后才能编辑或扫码预览。", "Existing placements use the saved scene. Restore it to edit or scan the preview."],
  "contentModel.integration.sceneEditor.archivedAsset": ["素材已归档，不能新增引用。", "This asset is archived and cannot be newly referenced."],
};

class ViewportBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export default function SceneEditor({ sceneId, initial, organizationId }: { sceneId: string; initial?: SceneDetailDto | null; organizationId: string | null }) {
  const { t } = useTranslation();
  const tx = useIntegrationText(TEXTS);
  const editor = useSceneDocument(sceneId, initial);
  const { session, document, clips, time, playing, commit, resolve, resources, detail, readOnly } = editor;
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
  if (!session || !document) return <main className="scene-editor-status fixed inset-0 z-50 flex items-center justify-center bg-background"><div className="max-w-lg space-y-4 p-6"><Text as="h1" variant="headingMd">{t("sceneEditor.heading")}</Text><Text as="p" variant="bodyMd" tone={editor.error ? "critical" : "subdued"}>{editor.error || t("sceneEditor.loading")}</Text>{editor.error && <Button onClick={editor.retry}>{t("sceneEditor.retry")}</Button>}</div></main>;
  const { instances, assets, loop } = document.definition.content;
  const duration = document.definition.content.durationSeconds ?? 10;
  // Scenes belong to the team.
  const sceneOrganizationId = detail?.organization_id ?? organizationId;
  const resolveUrl = (item: CompositionInstance) => resolve(assets[item.asset])?.url;
  const names = Object.fromEntries(instances.map((item) => {
    const model = resolve(assets[item.asset]);
    const siblings = instances.filter((other) => other.asset === item.asset);
    return [item.id, `${model?.name || t("sceneEditor.unnamedModel")}${siblings.length > 1 ? ` (${siblings.findIndex((other) => other.id === item.id) + 1})` : ""}`];
  }));
  const editInstance = (id: string, edit: (item: CompositionInstance) => CompositionInstance) => commit((current) => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, instances: current.definition.content.instances.map((item) => item.id === id ? edit(item) : item) } } }));
  /**
   * `key` is the asset ID. Instances of the same asset share an alias.
   * `picked` is the library resource behind a click or upload; it is not in `resources` until the next render.
   */
  const addModel = (key: string, position: ScenePosition = [0, 0, 0], picked?: SceneResource) => {
    if (readOnly) return;
    const id = `model_${crypto.randomUUID().slice(0, 8)}`;
    const outcome: { added?: boolean; failure?: ModelAddFailure } = {};
    // Plan against the latest document: an upload can finish after this render's edits.
    commit((current) => {
      const result = addModelInstance(current.definition.content, { key, resource: picked ?? resources[key], id, position });
      if (!result.ok) { outcome.failure = result.reason; return current; }
      outcome.added = true;
      return { ...current, definition: { ...current.definition, content: result.content } };
    });
    if (outcome.failure && outcome.failure !== "instanceLimit") editor.setError(outcome.failure === "assetLimit" ? t("sceneEditor.assetLimit") : outcome.failure === "archived" ? tx("contentModel.integration.sceneEditor.archivedAsset") : t("sceneEditor.missingModel"));
    if (!outcome.added) return;
    if (picked) editor.registerResource(picked);
    setSelectedId(id); setMobilePanel("scene");
  };
  const removeModel = () => {
    if (readOnly) return;
    const remaining = instances.filter((item) => item.id !== selectedId);
    commit((current) => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, instances: remaining, assets: Object.fromEntries(Object.entries(assets).filter(([alias]) => remaining.some((item) => item.asset === alias))) } } }));
    setSelectedId(null);
  };
  const changeTransform = (channel: TransformChannel, value: number) => { if (selectedId) editInstance(selectedId, (item) => setTransform(item, channel, value, time, record)); };
  const toggleKey = (group: TransformGroup) => {
    if (!instance || !values) return;
    editInstance(instance.id, (item) => keyTimes(item, group).some((position) => nearTime(position, time)) ? deleteKeys(item, group, time) : groupChannels(group).reduce((current, channel) => setTransform(current, channel, values[group][channel.split(".")[1] as "x" | "y" | "z"], time, true), item));
  };
  const missing = instances.some((item) => !resolve(assets[item.asset])?.url);
  const selectedResource = instance ? resolve(assets[instance.asset]) : undefined;
  return <main className="scene-workspace" data-mobile-panel={mobilePanel} data-preview={preview} aria-label={t("sceneEditor.heading")}>
    <h1 className="sr-only">{t("sceneEditor.heading")}</h1>
    <SceneToolbar title={document.title} dirty={editor.dirty} saving={editor.saving} preview={preview} canUndo={editor.canUndo} canRedo={editor.canRedo} onTitle={(title) => commit((current) => ({ ...current, title }))} onPreview={() => { setPreview(!preview); setMobilePanel("scene"); }} onSave={() => void editor.save()} onUndo={editor.undo} onRedo={editor.redo}
      backHref={teamHref("/manage/scenes", sceneOrganizationId)} readOnly={readOnly} status={detail?.state === "archived" ? <ContentStatusBadge kind="archived" /> : undefined}
      qr={detail?.state === "active" ? <SceneQrButton sceneId={sceneId} dirty={editor.dirty} /> : undefined} />
    {editor.conflict && <SceneConflictBanner draftJson={() => JSON.stringify({ name: document.title, document: document.definition }, null, 2)} fileName={`${document.title || "scene"}-draft.json`} onReload={editor.retry} onDismiss={editor.dismissConflict} />}
    {readOnly && detail && <div className="shrink-0 border-b bg-background px-4 py-2"><ContentNotice title={tx(detail.state === "archived" ? "contentModel.integration.sceneEditor.archivedTitle" : "contentModel.integration.sceneEditor.readOnlyTitle")} description={tx(detail.state === "archived" ? "contentModel.integration.sceneEditor.archivedBody" : "contentModel.integration.sceneEditor.readOnlyBody")} /></div>}
    {(editor.error || missing) && <div role="alert" className="flex shrink-0 items-center gap-3 border-b bg-background px-4 py-2"><Text as="p" variant="bodySm" tone="critical">{editor.error || t("sceneEditor.missingModel")}</Text></div>}
    <nav className="scene-mobile-tabs" aria-label={t("sceneEditor.panels")}>{["scene", "objects", "inspector", "timeline"].map((panel) => <Button key={panel} variant="ghost" size="sm" aria-pressed={mobilePanel === panel} onClick={() => setMobilePanel(panel)}>{t(`sceneEditor.${panel}`)}</Button>)}</nav>
    <SceneDockLayout mobilePanel={mobilePanel} preview={preview} objects={
      <SceneModels instances={instances} names={names} selectedId={instance?.id ?? null} onSelect={setSelectedId}
        library={sceneOrganizationId ? <SceneLibraryPanel organizationId={sceneOrganizationId}
          inScene={Object.entries(assets).map(([alias, ref]) => ({ alias, resource: resolve(ref), instanceCount: instances.filter((item) => item.asset === alias).length }))}
          canAdd={!readOnly && instances.length < COMPOSITION_LIMITS.maxInstances} canUpload={!readOnly} onRegister={editor.registerResource} onAdd={(resource) => addModel(resource.assetId ?? "", undefined, resource)}
          onSelectAlias={(alias) => setSelectedId(instances.find((item) => item.asset === alias)?.id ?? null)} /> : undefined} />} scene={
      <section className="scene-stage" aria-label={t("sceneEditor.sceneView")}>
        <div className="scene-stage-toolbar"><Text as="span" variant="bodyXs" fontWeight="semibold" className="mr-3">{t(preview ? "sceneEditor.preview" : "sceneEditor.scene")}</Text>{!preview && <>{([{ mode: "translate", icon: Move3D, key: "W" }, { mode: "rotate", icon: Rotate3D, key: "E" }, { mode: "scale", icon: Scaling, key: "R" }] as const).map(({ mode, icon: Icon, key }) => <Button key={mode} size="icon" variant={tool === mode ? "secondary" : "ghost"} className="size-7" aria-pressed={tool === mode} aria-label={t(`sceneEditor.${mode}Tool`)} title={`${t(`sceneEditor.${mode}Tool`)} (${key})`} onClick={() => setTool(mode)}><Icon /></Button>)}<div className="mx-2 h-4 border-l" /><Button size="icon" variant={grid ? "secondary" : "ghost"} className="size-7" aria-label={t("sceneEditor.grid")} aria-pressed={grid} title={t("sceneEditor.grid")} onClick={() => setGrid(!grid)}><Grid3X3 /></Button></>}<Button size="icon" variant="ghost" className="ml-auto size-7" aria-label={t("sceneEditor.fit")} title={`${t("sceneEditor.fit")} (F)`} onClick={() => fitRef.current?.()}><Maximize /></Button></div>
        <SceneModelDropZone canDrop={(key) => !!resources[key]?.url} enabled={!readOnly && !preview && instances.length < COMPOSITION_LIMITS.maxInstances} placementRef={placementRef} onAdd={addModel}><ViewportBoundary key={instances.map((item) => item.id).join(",")} fallback={<div className="flex items-center justify-center p-6"><Text as="p" variant="bodyMd" tone="critical">{t("sceneEditor.modelFailed")}</Text></div>}><SceneViewport placementRef={placementRef} session={session} instances={instances} resolveUrl={resolveUrl} onClips={editor.onClips} fitRef={fitRef} selectedId={preview ? null : instance?.id ?? null} onSelect={setSelectedId} grid={grid && !preview} tool={tool} editable={!readOnly && !playing && !preview} onTransform={(id, next) => editInstance(id, (item) => AXES.reduce((current, axis) => { const group = tool === "translate" ? "position" : tool === "rotate" ? "rotation" : "scale"; return setTransform(current, `${group}.${axis}`, next[group][axis], time, record); }, item))} /></ViewportBoundary>
          {!instances.length && <div className="scene-stage-empty"><Box className="size-9 text-muted-foreground" /><Text as="h2" variant="headingMd">{t("sceneEditor.emptyScene")}</Text><Text as="p" variant="bodyMd" tone="subdued">{t("sceneEditor.emptySceneHint")}</Text></div>}
          {!preview && !!instances.length && <div className="scene-stage-hint"><Text as="span" variant="bodyXs" tone="subdued">{t("sceneEditor.orbitHint")}</Text></div>}
        </SceneModelDropZone>
      </section>} inspector={
      <fieldset disabled={readOnly} className="contents"><SceneInspector instance={instance} name={instance && names[instance.id]} values={values ?? (instance && instanceValues(instance))} clips={instance && clips[instance.id]} time={time} duration={duration} record={record} playing={playing} onTransform={changeTransform} onKey={toggleKey} onAnimation={(animation) => { if (instance) editInstance(instance.id, (item) => ({ ...item, animation })); }} onRemove={removeModel}
        source={instance && selectedResource ? <SceneResourceSource resource={selectedResource} assetHref={teamHref(`/manage/assets/${selectedResource.assetId}`, sceneOrganizationId)} /> : undefined} /></fieldset>} timeline={
      <SceneTimeline instances={instances} names={names} clips={clips} selectedId={instance?.id ?? null} time={time} duration={duration} minDuration={minimumDuration(document.definition)} playing={playing} loop={loop} record={record} preview={preview} onSelect={setSelectedId} onSeek={editor.seek} onPlay={editor.play} onLoop={() => commit((current) => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, loop: !loop } } }))} onRecord={() => { session.sheet.sequence.pause(); setRecord(!record); }} onDuration={(durationSeconds) => commit((current) => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, durationSeconds } } }))} onMoveKey={(id, group, from, to) => { editInstance(id, (item) => moveKeys(item, group, from, to)); editor.seek(to); }} onDeleteKey={(id, group, at) => editInstance(id, (item) => deleteKeys(item, group, at))} onMoveClip={(id, startSeconds) => editInstance(id, (item) => ({ ...item, animation: item.animation && { ...item.animation, startSeconds } }))} />} />
    <footer className="scene-status"><Text as="span" variant="bodyXs" tone="subdued">{instance ? names[instance.id] : t("sceneEditor.noSelection")} · {t("sceneEditor.unitsShort")}</Text><Text as="span" variant="bodyXs" tone="subdued">{t("sceneEditor.shortcuts")}</Text></footer>
  </main>;
}
