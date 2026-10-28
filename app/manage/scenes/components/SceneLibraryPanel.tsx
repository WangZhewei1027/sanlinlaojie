"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/typography";
import { LoaderCircle, Search, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PERFORMANCE_KINDS, isPerformanceKind, resourceFromAsset, type PerformanceKind } from "./scene-performance";
import { newIdempotencyKey, organizationApi } from "../../lib/content-api";
import { errorMessage } from "../../lib/content-errors";
import { acceptFor, prepareFile, uploadAssetFiles } from "../../lib/content-upload";
import { useIntegrationText } from "../../lib/integration-text";
import type { SceneResource } from "./types";
import { SCENE_LIBRARY_TEXTS } from "./scene-library-texts";
import { SceneLibraryList } from "./SceneLibraryList";


export interface InSceneEntry { alias: string; resource: SceneResource | undefined; instanceCount: number }
type View = "scene" | "team";
const PAGE = 20;

/**
 * Media picker over the whole team. "In scene" lists the current references
 * independently of the catalog requests, so paging, filtering or archiving in
 * the team view can never make a referenced model disappear from the viewport.
 */
export function SceneLibraryPanel({ organizationId, inScene, canAdd, canUpload, onRegister, onAdd, onSelectAlias, selectedAlias, atCapacity }: {
  organizationId: string; inScene: InSceneEntry[]; selectedAlias?: string; canAdd: boolean; canUpload: boolean; atCapacity: boolean;
  /** Registers a dragged resource; the drop only carries its asset ID. */
  onRegister: (resource: SceneResource) => void;
  /** Receives the picked resource itself, so the first add never waits for a registration render. */
  onAdd: (resource: SceneResource) => void; onSelectAlias: (alias: string) => void;
}) {
  const tx = useIntegrationText(SCENE_LIBRARY_TEXTS);
  const [view, setView] = useState<View>("team");
  const [kind, setKind] = useState<PerformanceKind | "all">("all");
  const { i18n } = useTranslation();
  const text = (zh: string, en: string) => i18n.language.startsWith("zh") ? zh : en;
  const labels = { model: text("模型", "Models"), image: text("图片", "Images"), video: text("视频", "Video"), audio: text("音频", "Audio") };
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<SceneResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "more" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const requestEpoch = useRef(0);
  const uploadKey = useRef<{ file: File; key: string } | null>(null);

  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const load = (offset: number, signal?: AbortSignal) => {
    const epoch = ++requestEpoch.current;
    const request = organizationApi.assets(organizationId, { view: "all", q: search || undefined, file_type: kind === "all" ? undefined : kind, state: "active", limit: PAGE, offset }, signal);
    setError(""); setStatus(offset ? "more" : "loading");
    return request.then((page) => {
      if (signal?.aborted || epoch !== requestEpoch.current) return;
      const usable = page.data.filter((asset) => asset.capabilities.can_use_in_workspace !== false).map(resourceFromAsset).filter((item): item is SceneResource => !!item);
      setItems((current) => (offset ? [...current, ...usable] : usable));
      setLoaded(offset + page.data.length);
      setTotal(page.page?.total ?? offset + page.data.length);
      setStatus("ready");
    }).catch((cause) => { if (!signal?.aborted && epoch === requestEpoch.current) { setError(errorMessage(cause, tx)); setStatus("error"); } });
  };
  useEffect(() => {
    if (view === "scene") return;
    const abort = new AbortController();
    setItems([]);
    void load(0, abort.signal);
    // This ref is a monotonic request counter, not a DOM node; invalidate in-flight pagination too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { abort.abort(); requestEpoch.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load closes over the same view/search/ids
  }, [view, search, organizationId, kind]);

  const upload = async (file: File) => {
    setUploading(true); setError("");
    try {
      if (uploadKey.current?.file !== file) uploadKey.current = { file, key: newIdempotencyKey() };
      const type = /\.(glb|gltf)$/i.test(file.name) ? "model" : file.type.split("/")[0];
      if (!isPerformanceKind(type)) throw new Error(text("支持 GLB、图片、音频和视频文件。", "Choose a GLB, image, audio or video file."));
      const prepared = await prepareFile(file, type);
      // Team asset: no collection; every member can reuse it afterwards.
      const version = await uploadAssetFiles(prepared, { organizationId });
      const created = await organizationApi.createAsset(organizationId, { name: file.name.replace(/\.[^.]+$/, ""), fileType: type, payload: version.payload, resources: version.resources, idempotencyKey: uploadKey.current.key });
      uploadKey.current = null;
      const resource = resourceFromAsset(created.asset);
      if (resource) onAdd(resource);
    } catch (cause) { setError(errorMessage(cause, tx)); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  };

  return <section className="scene-library" aria-label={tx("contentModel.integration.sceneLibrary.label")}>
    <div className="scene-panel-heading"><Text as="h2" variant="bodySm" fontWeight="semibold">{tx("contentModel.integration.sceneLibrary.label")}</Text>
      {canUpload && <Button variant="ghost" size="icon" className="ml-auto size-8 shrink-0" title={tx(uploading ? "contentModel.integration.sceneLibrary.uploading" : "contentModel.integration.sceneLibrary.upload")} disabled={uploading || !canAdd} onClick={() => fileInput.current?.click()}>{uploading ? <LoaderCircle className="animate-spin" /> : <Upload />}<span className="sr-only">{tx(uploading ? "contentModel.integration.sceneLibrary.uploading" : "contentModel.integration.sceneLibrary.upload")}</span></Button>}
      <input ref={fileInput} type="file" hidden accept={PERFORMANCE_KINDS.map(acceptFor).filter(Boolean).join(",")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    </div>
    <div className="mx-3 mb-2 flex gap-1 rounded-md bg-muted p-1" role="group" aria-label={tx("contentModel.integration.sceneLibrary.label")}>
      {(["scene", "team"] as const).map((value) => <Button key={value} variant={view === value ? "outline" : "ghost"} size="sm" className="h-7 min-w-0 flex-1 px-2" aria-pressed={view === value} onClick={() => setView(value)}>{tx(`contentModel.integration.sceneLibrary.views.${value}`)}</Button>)}
    </div>
    {view !== "scene" && <div className="relative mx-3 mb-2"><Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={tx("contentModel.integration.sceneLibrary.search")} placeholder={tx("contentModel.integration.sceneLibrary.search")} className="h-8 pl-7 shadow-none" /></div>}
    <div className="scene-library-filters" role="group" aria-label={text("素材类型", "Asset type")}>{(["all", ...PERFORMANCE_KINDS] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>{value === "all" ? text("全部", "All") : labels[value]}</button>)}</div>
    {error && <Text as="p" variant="bodySm" tone="critical" role="alert" className="px-3 pt-2">{error}</Text>}
    {status === "error" && view === "team" && <Button variant="outline" size="sm" className="mx-3 my-2" onClick={() => void load(0)}>{tx("contentModel.integration.sceneLibrary.retry")}</Button>}
    <SceneLibraryList view={view} inScene={inScene.filter(entry => kind === "all" || (entry.resource?.kind ?? "model") === kind)} items={items} selectedAlias={selectedAlias} canAdd={canAdd} search={search} loading={status === "loading"} failed={status === "error"} onRegister={onRegister} onAdd={onAdd} onSelectAlias={onSelectAlias} />
    {view === "team" && (status === "ready" || status === "more") && loaded < total && <Button variant="ghost" size="sm" className="mx-3 mb-3" disabled={status === "more"} onClick={() => void load(loaded)}>{tx("contentModel.integration.sceneLibrary.loadMore")}</Button>}
    {atCapacity && canUpload && <Text as="p" variant="bodySm" tone="subdued" className="px-3 pb-3">{tx("contentModel.integration.sceneLibrary.limit")}</Text>}

  </section>;
}
