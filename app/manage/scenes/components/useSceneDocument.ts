"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { onChange } from "@theatre/core";
import { useTranslation } from "react-i18next";
import { parseSceneText } from "@/lib/scene/validate";
import type { SceneDefinition } from "@/lib/scene/protocol";
import { createTheatreSession, type TheatreSession } from "./theatre-session";
import type { ClipInfo, ModelAsset, SceneEditorAsset } from "./types";

export type SceneDocument = { title: string; definition: SceneDefinition };
export function useSceneDocument(assetId: string) {
  const { t } = useTranslation();
  const [session, setSession] = useState<TheatreSession | null>(null);
  const [document, setDocument] = useState<SceneDocument | null>(null);
  const [models, setModels] = useState<ModelAsset[]>([]);
  const [clips, setClips] = useState<Record<string, ClipInfo[]>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState("");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [retry, setRetry] = useState(0);
  const revision = useRef("");
  const latest = useRef(document); latest.current = document;
  const history = useRef<{ past: SceneDocument[]; future: SceneDocument[] }>({ past: [], future: [] });
  const savingRef = useRef(false);
  const dirty = !!document && JSON.stringify(document) !== baseline;
  useEffect(() => {
    let cancelled = false;
    let active: TheatreSession | undefined;
    const abort = new AbortController();
    const cleanup: (() => void)[] = [];
    setError("");
    (async () => {
      const response = await fetch(`/api/assets/${assetId}`, { signal: abort.signal, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const asset: SceneEditorAsset = body.data;
      const definition = parseSceneText(asset.text_content);
      if (cancelled) return;
      active = await createTheatreSession(assetId, definition);
      if (cancelled) { active.dispose(); return; }
      const loaded = { title: asset.name ?? "", definition };
      setModels(body.models); setDocument(loaded); setBaseline(JSON.stringify(loaded));
      revision.current = asset.scene_revision; history.current = { past: [], future: [] };
      cleanup.push(onChange(active.sheet.sequence.pointer.position, setTime));
      cleanup.push(onChange(active.sheet.sequence.pointer.playing, setPlaying));
      setSession(active);
    })().catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; abort.abort(); cleanup.forEach((fn) => fn()); active?.dispose(); };
  }, [assetId, retry]);
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
  const commit = useCallback((edit: (current: SceneDocument) => SceneDocument) => {
    const previous = latest.current;
    if (!previous || !session) return;
    try {
      const next = edit(previous);
      if (JSON.stringify(next) === JSON.stringify(previous)) return;
      if (JSON.stringify(next.definition) !== JSON.stringify(previous.definition)) {
        const content = next.definition.content;
        const animated = content.instances.some((item) => item.animation || Object.values(item.tracks ?? {}).some((frames) => frames?.length));
        next.definition = parseSceneText(JSON.stringify({ ...next.definition, schemaVersion: 2, content: { ...content, durationSeconds: animated ? content.durationSeconds ?? 10 : content.durationSeconds } }));
        session.sync(next.definition);
      }
      history.current.past = [...history.current.past.slice(-99), previous]; history.current.future = [];
      latest.current = next; setDocument(next); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }, [session]);
  const travel = (direction: "past" | "future") => {
    const next = history.current[direction].at(-1);
    if (!next || !session || !latest.current) return;
    session.sync(next.definition);
    history.current[direction].pop();
    history.current[direction === "past" ? "future" : "past"].push(latest.current);
    latest.current = next; setDocument(next); setError("");
  };
  const onClips = useCallback((id: string, value: ClipInfo[]) => setClips((current) => ({ ...current, [id]: value })), []);
  const save = useCallback(async () => {
    const snapshot = latest.current;
    if (!snapshot || !session || savingRef.current) return;
    setError("");
    try {
      if (!snapshot.title.trim()) throw new Error(t("sceneEditor.titleRequired"));
      const { instances, assets } = snapshot.definition.content;
      for (const instance of instances) {
        if (!models.some((model) => model.id === assets[instance.asset]?.assetId)) throw new Error(t("sceneEditor.missingModel"));
        if (instance.animation) {
          const available = clips[instance.id];
          const clip = instance.animation.clipIndex !== undefined ? available?.[instance.animation.clipIndex] : available?.find((item) => item.name === instance.animation?.clipName);
          if (!clip || !(clip.duration > 0)) throw new Error(t("sceneEditor.invalidClip"));
        }
      }
      session.sheet.sequence.pause(); savingRef.current = true; setSaving(true);
      const response = await fetch(`/api/assets/${assetId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: snapshot.title, text_content: JSON.stringify(snapshot.definition), scene_revision: revision.current }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      revision.current = result.data.scene_revision; setBaseline(JSON.stringify(snapshot));
      const channel = new BroadcastChannel("scene-assets"); channel.postMessage({ id: assetId }); channel.close();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { savingRef.current = false; setSaving(false); }
  }, [session, models, clips, assetId, t]);
  const seek = (position: number) => { if (session) { session.sheet.sequence.pause(); session.sheet.sequence.position = position; } };
  const play = () => {
    if (!session || !document) return;
    if (playing) { session.sheet.sequence.pause(); return; }
    if (session.sheet.sequence.position >= (document.definition.content.durationSeconds ?? 10)) session.sheet.sequence.position = 0;
    session.sheet.sequence.play({ iterationCount: document.definition.content.loop ? Infinity : 1 }).catch((err) => setError(String(err)));
  };
  return { session, document, models, clips, onClips, error, setError, saving, dirty, time, playing, commit, save, seek, play, undo: () => travel("past"), redo: () => travel("future"), canUndo: history.current.past.length > 0, canRedo: history.current.future.length > 0, retry: () => setRetry((n) => n + 1) };
}
