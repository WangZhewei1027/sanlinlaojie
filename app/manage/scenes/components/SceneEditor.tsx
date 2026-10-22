"use client";
import { SceneQrButton } from "@/components/scene-qr-button";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import type { SceneDetailDto } from "@/lib/content-model/contracts";
import type { PlacementReader, ScenePosition } from "@/lib/scene/editor-interactions";
import { COMPOSITION_LIMITS, type CompositionInstance } from "@/lib/scene/protocol";
import { Pause, Play } from "lucide-react";
import { Component, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { teamHref } from "../../lib/content-context";
import { addModelInstance, type ModelAddFailure } from "./scene-add-model";
import { SceneConflictBanner } from "./SceneConflictBanner";
import { SceneInstancePanel } from "./SceneInstancePanel";
import { SceneTimeline } from "./SceneTimeline";
import { editTransform } from "@/lib/scene/transform-authoring";
import { SceneSidebar } from "./SceneSidebar";
import { useSceneEditorShortcuts } from "./useSceneEditorShortcuts";
import { useSceneWorkspace } from "./useSceneWorkspace";
import { SceneLibraryPanel } from "./SceneLibraryPanel";
import { SceneModelDropZone } from "./SceneModelDropZone";
import { SceneToolbar } from "./SceneToolbar";
import { SceneViewport } from "./SceneViewport";
import type { SceneResource } from "./types";
import { useSceneDocument } from "./useSceneDocument";
import "./scene-editor.css";

class ViewportBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export default function SceneEditor({ sceneId, initial, organizationId }: { sceneId: string; initial?: SceneDetailDto | null; organizationId: string | null }) {
  const { t, i18n } = useTranslation();
  const text = (zh: string, en: string) => i18n.language.startsWith("zh") ? zh : en;
  const editor = useSceneDocument(sceneId, initial);
  const { session, document, clips, time, playing, commit, resolve, resources, detail, readOnly } = editor;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [grid, setGrid] = useState(true);
  const [headerElement, setHeaderElement] = useState<HTMLDivElement | null>(null);
  const nativeToolsRef = useRef<HTMLDivElement>(null);
  const placementRef = useRef<PlacementReader | null>(null);
  const fitRef = useRef<(() => void) | null>(null);
  const { compact, panelOpen, togglePanel } = useSceneWorkspace();
  const instance = document?.definition.content.instances.find((item) => item.id === selectedId);
  useSceneEditorShortcuts(editor);
  if (!session || !document) return <main className="scene-workspace-theme scene-editor-status fixed inset-0 z-50 flex items-center justify-center bg-background"><div className="max-w-lg space-y-4 p-6"><Text as="h1" variant="headingMd">{t("sceneEditor.heading")}</Text><Text as="p" variant="bodyMd" tone={editor.error ? "critical" : "subdued"}>{editor.error || t("sceneEditor.loading")}</Text>{editor.error && <Button onClick={editor.retry}>{t("sceneEditor.retry")}</Button>}</div></main>;
  const { instances, assets, loop } = document.definition.content;
  const sceneOrganizationId = detail?.organization_id ?? organizationId;
  const select = setSelectedId;
  const editInstance = (edit: (instance: CompositionInstance) => CompositionInstance, id = selectedId) => commit(current => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, instances: current.definition.content.instances.map(item => item.id === id ? edit(item) : item) } } }));
  const addModel = (key: string, position: ScenePosition = [0, 0, 0], picked?: SceneResource) => {
    if (readOnly) return;
    const id = `model_${crypto.randomUUID().slice(0, 8)}`;
    const outcome: { added?: boolean; failure?: ModelAddFailure } = {};
    commit((current) => {
      const result = addModelInstance(current.definition.content, { key, resource: picked ?? resources[key], id, position });
      if (!result.ok) { outcome.failure = result.reason; return current; }
      outcome.added = true;
      return { ...current, definition: { ...current.definition, content: result.content } };
    });
    if (outcome.failure) editor.setError(t(outcome.failure === "assetLimit" ? "sceneEditor.assetLimit" : "sceneEditor.missingModel"));
    if (outcome.added) { if (picked) editor.registerResource(picked); select(id); }
  };
  const editAnimation = (animation: CompositionInstance["animation"]) => commit((current) => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, instances: current.definition.content.instances.map((item) => item.id === selectedId ? { ...item, animation } : item) } } }));
  const removeModel = () => {
    commit((current) => {
      const content = current.definition.content;
      const remaining = content.instances.filter((item) => item.id !== selectedId);
      return { ...current, definition: { ...current.definition, content: { ...content, instances: remaining, assets: Object.fromEntries(Object.entries(content.assets).filter(([alias]) => remaining.some((item) => item.asset === alias))) } } };
    });
    select(null);
  };
  const selectedResource = instance ? resolve(assets[instance.asset]) : undefined;
  const available = instance ? clips[instance.id] : undefined;
  const toolbar = <>
    <SceneToolbar panelOpen={panelOpen} onTogglePanel={togglePanel} title={document.title} dirty={editor.dirty} saving={editor.saving} preview={preview} canUndo={editor.canUndo} canRedo={editor.canRedo} onUndo={editor.undo} onRedo={editor.redo} onTitle={(title) => commit((current) => ({ ...current, title }))} onPreview={() => setPreview(!preview)} onSave={() => void editor.save()} backHref={teamHref("/manage/scenes", sceneOrganizationId)} readOnly={readOnly} qr={detail?.state === "active" ? <SceneQrButton sceneId={sceneId} dirty={editor.dirty} portalContainer={headerElement} /> : undefined} />
    {editor.conflict && <SceneConflictBanner draftJson={() => JSON.stringify({ name: document.title, document: { ...document.definition, content: document.definition.content } }, null, 2)} fileName={`${document.title || "scene"}-draft.json`} onReload={editor.retry} onDismiss={editor.dismissConflict} />}
    {editor.error && <div role="alert" className="border-b bg-background p-3"><Text as="p" variant="bodySm" tone="critical">{editor.error}</Text></div>}
    {readOnly && <ContentNotice title={text("只读场景", "Read-only scene")} description={text("可以预览播放；当前权限或归档状态不允许编辑。", "Preview and playback are available. This scene cannot be edited with the current permissions or archive status.")} />}
  </>;
  const controls = <SceneSidebar nativeToolsRef={nativeToolsRef} grid={grid} onGrid={() => setGrid(!grid)} onFit={() => fitRef.current?.()} time={time} playing={playing} loop={loop} readOnly={readOnly} compact={compact} onPlay={editor.play} onLoop={(loop) => commit((current) => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, loop } } }))}>
    {sceneOrganizationId && <SceneLibraryPanel organizationId={sceneOrganizationId} selectedAlias={instance?.asset} inScene={Object.entries(assets).map(([alias, ref]) => ({ alias, resource: resolve(ref), instanceCount: instances.filter((item) => item.asset === alias).length }))} canAdd={!readOnly && instances.length < COMPOSITION_LIMITS.maxInstances} canUpload={!readOnly} onRegister={editor.registerResource} onAdd={(resource) => addModel(resource.assetId ?? "", undefined, resource)} onSelectAlias={(alias) => select(instances.find((item) => item.asset === alias)?.id ?? null)} />}
    <div className="border-t p-3"><label className="mb-2 block text-xs text-muted-foreground" htmlFor="scene-object-select">{text("场景对象", "Scene objects")}</label><select id="scene-object-select" className="scene-select w-full" value={instance?.id ?? ""} onChange={e => select(e.target.value || null)}><option value="">{text("选择对象", "Select an object")}</option>{instances.map(item => <option value={item.id} key={item.id}>{resolve(assets[item.asset])?.name ?? item.asset} · {item.id.slice(-4)}</option>)}</select></div>
    <SceneInstancePanel key={instance?.id ?? "empty"} instance={instance} resource={selectedResource} assetHref={teamHref(`/manage/assets/${selectedResource?.assetId}`, sceneOrganizationId)} clips={available} readOnly={readOnly} playing={playing} onAnimation={editAnimation} onRemove={removeModel} />
  </SceneSidebar>;
  return <main className="scene-workspace-theme scene-native-stage fixed inset-0 z-50 bg-background" aria-label={t("sceneEditor.sceneView")}>
    <div ref={setHeaderElement} className="relative z-50 shrink-0">{toolbar}</div>
    <div className="scene-workbench">
    <aside id="scene-assets" className="scene-workspace-sidebar" hidden={preview || !panelOpen}>{controls}</aside>
    <div className="scene-stage-content">
    <SceneModelDropZone canDrop={(key) => !!resources[key]?.url} enabled={!readOnly && !preview && instances.length < COMPOSITION_LIMITS.maxInstances} placementRef={placementRef} onAdd={addModel}>
      <ViewportBoundary key={instances.map((item) => item.id).join(",")} fallback={<Text as="p" variant="bodyMd" tone="critical">{t("sceneEditor.modelFailed")}</Text>}>
        <SceneViewport placementRef={placementRef} session={session} instances={instances} resolveUrl={(item) => resolve(assets[item.asset])?.url} onClips={editor.onClips} fitRef={fitRef} selectedId={preview ? null : selectedId} onSelect={select} grid={grid && !preview} toolsRef={nativeToolsRef} language={i18n.language} preview={preview} onError={editor.setError} editable={!readOnly && !playing && !preview} onTransform={(id, group, value) => editInstance(instance => editTransform(instance, group, session.time, value), id)} />
      </ViewportBoundary>
    </SceneModelDropZone>
    {!preview && <SceneTimeline key={instance?.id ?? "empty"} instance={instance} name={selectedResource?.name ?? undefined} time={time} duration={document.definition.content.durationSeconds ?? 10} loop={loop} playing={playing} readOnly={readOnly} onSeek={editor.seek} onPlay={editor.play} onEdit={editInstance} onDuration={durationSeconds => commit(current => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, durationSeconds } } }))} onLoop={loop => commit(current => ({ ...current, definition: { ...current.definition, content: { ...current.definition.content, loop } } }))} />}
    </div></div>
    {preview && <div className="absolute bottom-4 left-4 right-4 flex w-fit max-w-full flex-wrap gap-2 rounded-md border bg-background p-2"><Button variant="secondary" onClick={editor.play}>{playing ? <Pause /> : <Play />}{text(playing ? "暂停" : "播放", playing ? "Pause" : "Play")}</Button>{preview && <Button variant="outline" onClick={() => setPreview(false)}>{text("返回编排", "Back to editor")}</Button>}<Text as="span" variant="bodySm" tone="subdued" className="self-center px-2">{time.toFixed(2)} s</Text></div>}
  </main>;
}
