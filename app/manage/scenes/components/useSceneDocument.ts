"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { onChange } from "@theatre/core";
import { useTranslation } from "react-i18next";
import { parseSceneText } from "@/lib/scene/validate";
import type { SceneDetailDto, SceneResolvedResourceDto } from "@/lib/content-model/contracts";
import { isLockConflict, sceneApi } from "../../lib/content-api";
import { normalizeDefinition, fromV3, theatreView, toV3, type EditorAssetRef, type EditorDefinition } from "../../lib/scene-v3";
import { createTheatreSession, type TheatreSession } from "./theatre-session";
import { resourceKey } from "./scene-add-model";
import type { ClipInfo, ModelAsset, SceneEditorAsset, SceneMode, SceneResource } from "./types";

export type SceneDocument = { title: string; definition: EditorDefinition };
export interface SaveConflict { message: string }

function fromResolved(resource: SceneResolvedResourceDto): SceneResource {
  return {
    assetId: resource.asset_id, assetVersionId: resource.asset_version_id, name: resource.asset_name, url: resource.url, versionNo: resource.version_no,
    currentVersionId: resource.current_version_id, currentVersionNo: resource.current_version_no, upgradeAvailable: resource.upgrade_available,
    assetState: resource.asset_state, animations: resource.animations,
  };
}
function fromModel(model: ModelAsset): SceneResource {
  return { assetId: model.id, assetVersionId: null, name: model.name, url: model.file_url, versionNo: null, currentVersionId: null, currentVersionNo: null, upgradeAvailable: false, assetState: "active" };
}
const indexResolved = (list: SceneResolvedResourceDto[]) => Object.fromEntries(list.map((item) => [item.asset_version_id, fromResolved(item)]));

export function useSceneDocument(sceneId: string, mode: SceneMode, initial?: SceneDetailDto | null) {
  const { t } = useTranslation();
  const [session, setSession] = useState<TheatreSession | null>(null);
  const [document, setDocument] = useState<SceneDocument | null>(null);
  const [models, setModels] = useState<ModelAsset[]>([]);
  const [resources, setResources] = useState<Record<string, SceneResource>>({});
  const [detail, setDetail] = useState<SceneDetailDto | null>(null);
  const [clips, setClips] = useState<Record<string, ClipInfo[]>>({});
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<SaveConflict | null>(null);
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState("");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [retry, setRetry] = useState(0);
  const lock = useRef<string | number>("");
  const initialRef = useRef(initial ?? null);
  const latest = useRef(document); latest.current = document;
  const history = useRef<{ past: SceneDocument[]; future: SceneDocument[] }>({ past: [], future: [] });
  const savingRef = useRef(false);
  const dirty = !!document && JSON.stringify(document) !== baseline;
  const readOnly = mode === "v2" && (!detail || !detail.capabilities.can_edit || detail.state === "archived");
  useEffect(() => {
    let cancelled = false;
    let active: TheatreSession | undefined;
    const abort = new AbortController();
    const cleanup: (() => void)[] = [];
    setError(""); setConflict(null);
    (async () => {
      let loaded: SceneDocument;
      if (mode === "v2") {
        // Both Strict Mode runs may use the route's prefetch; only an explicit reload refetches.
        const prefetched = retry === 0 ? initialRef.current : null;
        const scene = prefetched ?? await sceneApi.get(sceneId, abort.signal);
        loaded = { title: scene.name, definition: fromV3(scene.draft_document) };
        if (cancelled) return;
        setDetail(scene); setResources(indexResolved(scene.referenced_resources)); lock.current = scene.lock_version;
      } else {
        const response = await fetch(`/api/assets/${sceneId}`, { signal: abort.signal, cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        const asset: SceneEditorAsset = body.data;
        loaded = { title: asset.name ?? "", definition: parseSceneText(asset.text_content) as EditorDefinition };
        if (cancelled) return;
        const list: ModelAsset[] = body.models ?? [];
        setModels(list); setResources(Object.fromEntries(list.map((model) => [model.id, fromModel(model)]))); lock.current = asset.scene_revision;
      }
      active = await createTheatreSession(sceneId, theatreView(loaded.definition));
      if (cancelled) { active.dispose(); return; }
      setDocument(loaded); setBaseline(JSON.stringify(loaded));
      history.current = { past: [], future: [] };
      cleanup.push(onChange(active.sheet.sequence.pointer.position, setTime));
      cleanup.push(onChange(active.sheet.sequence.pointer.playing, setPlaying));
      setSession(active);
    })().catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; abort.abort(); cleanup.forEach((fn) => fn()); active?.dispose(); };
  }, [sceneId, mode, retry]);
  useEffect(() => {
    const previous = window.document.title;
    window.document.title = [document?.title.trim(), t("sceneEditor.heading")].filter(Boolean).join(" · ");
    return () => { window.document.title = previous; };
  }, [document?.title, t]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty || savingRef.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const resolve = useCallback((ref: EditorAssetRef | undefined) => resources[resourceKey(mode, ref)], [resources, mode]);
  const registerResource = useCallback((resource: SceneResource) => {
    const key = mode === "v2" ? resource.assetVersionId : resource.assetId;
    if (key) setResources((current) => ({ ...current, [key]: { ...current[key], ...resource } }));
  }, [mode]);
  const commit = useCallback((edit: (current: SceneDocument) => SceneDocument) => {
    const previous = latest.current;
    if (!previous || !session || readOnly) return;
    try {
      const next = edit(previous);
      if (JSON.stringify(next) === JSON.stringify(previous)) return;
      if (JSON.stringify(next.definition) !== JSON.stringify(previous.definition)) {
        // Legacy asset scenes keep their schema-2 upgrade on edit; schema 3 drafts stay schema 3.
        next.definition = normalizeDefinition(mode === "legacy" ? { ...next.definition, schemaVersion: 2 } : next.definition);
        session.sync(theatreView(next.definition));
      }
      history.current.past = [...history.current.past.slice(-99), previous]; history.current.future = [];
      latest.current = next; setDocument(next); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }, [session, readOnly, mode]);
  const travel = (direction: "past" | "future") => {
    const next = history.current[direction].at(-1);
    if (!next || !session || !latest.current) return;
    session.sync(theatreView(next.definition));
    history.current[direction].pop();
    history.current[direction === "past" ? "future" : "past"].push(latest.current);
    latest.current = next; setDocument(next); setError("");
  };
  const onClips = useCallback((id: string, value: ClipInfo[]) => setClips((current) => ({ ...current, [id]: value })), []);
  /** Saves the draft only; publishing is a separate, explicit command. Resolves true on success. */
  const save = useCallback(async () => {
    const snapshot = latest.current;
    if (!snapshot || !session || savingRef.current || readOnly) return false;
    setError("");
    try {
      if (!snapshot.title.trim()) throw new Error(t("sceneEditor.titleRequired"));
      const { instances, assets } = snapshot.definition.content;
      for (const instance of instances) {
        if (!resources[resourceKey(mode, assets[instance.asset])]?.url) throw new Error(t("sceneEditor.missingModel"));
        if (instance.animation) {
          const available = clips[instance.id];
          const clip = instance.animation.clipIndex !== undefined ? available?.[instance.animation.clipIndex] : available?.find((item) => item.name === instance.animation?.clipName);
          if (!clip || !(clip.duration > 0)) throw new Error(t("sceneEditor.invalidClip"));
        }
      }
      session.sheet.sequence.pause(); savingRef.current = true; setSaving(true);
      if (mode === "v2") {
        try {
          const saved = await sceneApi.save(sceneId, { expectedLockVersion: Number(lock.current), name: snapshot.title, document: toV3(snapshot.definition) });
          lock.current = saved.lock_version; setDetail(saved);
          setResources((current) => ({ ...current, ...indexResolved(saved.referenced_resources) }));
        } catch (err) {
          // Stale or missing lock: keep the local draft untouched and offer recovery; never overwrite.
          if (isLockConflict(err)) { setConflict({ message: err instanceof Error ? err.message : String(err) }); return false; }
          throw err;
        }
      } else {
        const response = await fetch(`/api/assets/${sceneId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: snapshot.title, text_content: JSON.stringify(snapshot.definition), scene_revision: lock.current }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        lock.current = result.data.scene_revision;
        const channel = new BroadcastChannel("scene-assets"); channel.postMessage({ id: sceneId }); channel.close();
      }
      setBaseline(JSON.stringify(snapshot)); setConflict(null);
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); return false; }
    finally { savingRef.current = false; setSaving(false); }
  }, [session, resources, clips, sceneId, mode, readOnly, t]);
  const seek = (position: number) => { if (session) { session.sheet.sequence.pause(); session.sheet.sequence.position = position; } };
  const play = () => {
    if (!session || !document) return;
    if (playing) { session.sheet.sequence.pause(); return; }
    if (session.sheet.sequence.position >= (document.definition.content.durationSeconds ?? 10)) session.sheet.sequence.position = 0;
    session.sheet.sequence.play({ iterationCount: document.definition.content.loop ? Infinity : 1 }).catch((err) => setError(String(err)));
  };
  return {
    mode, session, document, models, resources, resolve, registerResource, detail, setDetail, lockVersion: () => lock.current,
    clips, onClips, error, setError, conflict, dismissConflict: () => setConflict(null), saving, dirty, readOnly, time, playing, commit, save, seek, play,
    undo: () => travel("past"), redo: () => travel("future"), canUndo: history.current.past.length > 0, canRedo: history.current.future.length > 0,
    retry: () => setRetry((n) => n + 1),
  };
}
export type SceneEditorState = ReturnType<typeof useSceneDocument>;
