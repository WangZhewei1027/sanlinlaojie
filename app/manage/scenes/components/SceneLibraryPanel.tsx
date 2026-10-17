"use client";
import { ContentStatusBadge } from "@/app/manage/content/ContentStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/typography";
import type { AssetDto } from "@/lib/content-model/contracts";
import { MODEL_DRAG_TYPE } from "@/lib/scene/editor-interactions";
import { Box, LoaderCircle, Plus, Search, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { newIdempotencyKey, organizationApi } from "../../lib/content-api";
import { ERROR_TEXTS, errorMessage } from "../../lib/content-errors";
import { primaryResource } from "../../lib/content-mappers";
import { acceptFor, prepareFile, uploadFileVersion } from "../../lib/content-upload";
import { useIntegrationText, type IntegrationTexts } from "../../lib/integration-text";
import type { SceneResource } from "./types";

const TEXTS: IntegrationTexts = {
  ...ERROR_TEXTS,
  "contentModel.integration.sceneLibrary.label": ["模型素材", "Model assets"],
  "contentModel.integration.sceneLibrary.views.scene": ["本场景", "In scene"],
  "contentModel.integration.sceneLibrary.views.team": ["团队模型", "Team models"],
  "contentModel.integration.sceneLibrary.search": ["搜索模型…", "Search models…"],
  "contentModel.integration.sceneLibrary.add": ["添加 {{name}} v{{version}}", "Add {{name}} v{{version}}"],
  "contentModel.integration.sceneLibrary.drag": ["拖入场景，或点击 + 添加；固定为 v{{version}}", "Drag into the scene or click +; pinned to v{{version}}"],
  "contentModel.integration.sceneLibrary.upload": ["上传并添加", "Upload and add"],
  "contentModel.integration.sceneLibrary.uploading": ["正在上传…", "Uploading…"],
  "contentModel.integration.sceneLibrary.loadMore": ["加载更多", "Load more"],
  "contentModel.integration.sceneLibrary.emptyScene": ["场景还没有引用模型。", "The scene does not reference any model yet."],
  "contentModel.integration.sceneLibrary.emptyTeam": ["团队还没有 3D 模型。可直接上传，上传后整个团队都能看到。", "The team has no 3D models yet. Upload one; the whole team will see it."],
  "contentModel.integration.sceneLibrary.noResults": ["没有匹配的模型", "No matching models"],
  "contentModel.integration.sceneLibrary.instances": ["{{count}} 个对象", "{{count}} objects"],
  "contentModel.integration.sceneLibrary.missing": ["文件缺失", "File missing"],
  "contentModel.integration.sceneLibrary.pinnedHint": ["场景引用固定版本；素材更新不会自动改变场景。", "Scenes pin versions; asset updates never change a scene by themselves."],
};

export interface InSceneEntry { alias: string; resource: SceneResource | undefined; instanceCount: number }
type View = "scene" | "team";
const PAGE = 20;

function candidateOf(asset: AssetDto): SceneResource | null {
  const version = asset.current_version;
  if (!asset.current_version_id || !version) return null;
  return {
    assetId: asset.id, assetVersionId: asset.current_version_id, name: asset.name, url: primaryResource(version)?.url ?? null,
    versionNo: asset.current_version_no, currentVersionId: asset.current_version_id, currentVersionNo: asset.current_version_no,
    upgradeAvailable: false, assetState: asset.state, animations: version.payload.kind === "model" ? version.payload.animations : undefined,
  };
}

/**
 * model picker over the whole team. "In scene" lists the pinned references
 * independently of the catalog requests, so paging, filtering or archiving in
 * the team view can never make a referenced model disappear from the viewport.
 */
export function SceneLibraryPanel({ organizationId, inScene, canAdd, canUpload, onRegister, onAdd, onSelectAlias }: {
  organizationId: string; inScene: InSceneEntry[]; canAdd: boolean; canUpload: boolean;
  /** Registers a dragged resource; the drop only carries its pinned version id. */
  onRegister: (resource: SceneResource) => void;
  /** Receives the picked resource itself, so the first add never waits for a registration render. */
  onAdd: (resource: SceneResource) => void; onSelectAlias: (alias: string) => void;
}) {
  const tx = useIntegrationText(TEXTS);
  const [view, setView] = useState<View>("scene");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<SceneResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "more" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadKey = useRef<{ file: File; key: string } | null>(null);

  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const load = (offset: number, signal?: AbortSignal) => {
    const request = organizationApi.assets(organizationId, { view: "all", q: search || undefined, file_type: "model", state: "active", limit: PAGE, offset }, signal);
    setStatus(offset ? "more" : "loading");
    return request.then((page) => {
      const usable = page.data.filter((asset) => asset.capabilities.can_use_in_workspace !== false).map(candidateOf).filter((item): item is SceneResource => !!item);
      setItems((current) => (offset ? [...current, ...usable] : usable));
      setLoaded(offset + page.data.length);
      setTotal(page.page?.total ?? offset + page.data.length);
      setStatus("ready");
    }).catch((cause) => { if (!signal?.aborted) { setError(errorMessage(cause, tx)); setStatus("error"); } });
  };
  useEffect(() => {
    if (view === "scene") return;
    const abort = new AbortController();
    setItems([]);
    void load(0, abort.signal);
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load closes over the same view/search/ids
  }, [view, search, organizationId]);

  const upload = async (file: File) => {
    setUploading(true); setError("");
    try {
      if (uploadKey.current?.file !== file) uploadKey.current = { file, key: newIdempotencyKey() };
      const prepared = await prepareFile(file, "model");
      // Team asset: no collection; every member can reuse it afterwards.
      const version = await uploadFileVersion(prepared, { organizationId });
      const created = await organizationApi.createAsset(organizationId, { name: file.name.replace(/\.(glb|gltf)$/i, ""), fileType: "model", payload: version.payload, resources: version.resources, idempotencyKey: uploadKey.current.key });
      uploadKey.current = null;
      const resource = candidateOf({ ...created.asset, current_version: created.version, current_version_id: created.version.id, current_version_no: created.version.version_no });
      if (resource) onAdd(resource);
    } catch (cause) { setError(errorMessage(cause, tx)); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  };

  const row = (resource: SceneResource, key: string, extra?: React.ReactNode, onPick?: () => void) => {
    const name = resource.name || "—";
    const versionId = resource.assetVersionId;
    const draggable = canAdd && !!resource.url && !!versionId;
    return <div key={key} className="scene-library-row" draggable={draggable} title={tx("contentModel.integration.sceneLibrary.drag", { version: resource.versionNo ?? "?" })} onDragStart={(event) => {
      if (!draggable || !versionId || (event.target as HTMLElement).closest("button")) { event.preventDefault(); return; }
      onRegister(resource); event.dataTransfer.setData(MODEL_DRAG_TYPE, versionId); event.dataTransfer.effectAllowed = "copy";
    }}>
      <Box className="size-5 shrink-0 text-muted-foreground" />
      <button type="button" className="min-w-0 flex-1 text-start" onClick={onPick} disabled={!onPick}>
        <Text as="span" variant="bodySm" truncate className="block" title={name}>{name}</Text>
        <span className="flex items-center gap-1.5"><Text as="span" variant="bodyXs" tone="subdued" className="tabular-nums">v{resource.versionNo ?? "?"}</Text>{extra}</span>
      </button>
      <Button variant="ghost" size="icon" className="size-8" draggable={false} disabled={!draggable} aria-label={tx("contentModel.integration.sceneLibrary.add", { name, version: resource.versionNo ?? "?" })} onClick={() => onAdd(resource)}><Plus /></Button>
    </div>;
  };

  const empty = (key: string) => <Text as="p" variant="bodySm" tone="subdued" className="px-2 py-3">{tx(search && view !== "scene" ? "contentModel.integration.sceneLibrary.noResults" : key)}</Text>;
  return <section className="scene-library" aria-label={tx("contentModel.integration.sceneLibrary.label")}>
    <div className="scene-panel-heading"><Box className="size-3.5" /><Text as="h2" variant="bodyXs" fontWeight="semibold">{tx("contentModel.integration.sceneLibrary.label")}</Text>
      {canUpload && <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" disabled={uploading || !canAdd} onClick={() => fileInput.current?.click()}>{uploading ? <LoaderCircle className="animate-spin" /> : <Upload />}<span className="sr-only sm:not-sr-only">{tx(uploading ? "contentModel.integration.sceneLibrary.uploading" : "contentModel.integration.sceneLibrary.upload")}</span></Button>}
      <input ref={fileInput} type="file" hidden accept={acceptFor("model")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    </div>
    <div className="flex gap-1 px-2 pt-2" role="group" aria-label={tx("contentModel.integration.sceneLibrary.label")}>
      {(["scene", "team"] as const).map((value) => <Button key={value} variant={view === value ? "secondary" : "ghost"} size="sm" className="h-7 flex-1 px-2" aria-pressed={view === value} onClick={() => setView(value)}>{tx(`contentModel.integration.sceneLibrary.views.${value}`)}</Button>)}
    </div>
    {view !== "scene" && <div className="relative m-2"><Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={tx("contentModel.integration.sceneLibrary.search")} placeholder={tx("contentModel.integration.sceneLibrary.search")} className="h-8 pl-7 shadow-none" /></div>}
    {error && <Text as="p" variant="bodySm" tone="critical" role="alert" className="px-3 pt-2">{error}</Text>}
    <div className="scene-scroll px-2 pb-2">
      {view === "scene" ? <>
        {inScene.map(({ alias, resource, instanceCount }) => resource ? row(resource, alias, <>
          <Text as="span" variant="bodyXs" tone="subdued">· {tx("contentModel.integration.sceneLibrary.instances", { count: instanceCount })}</Text>
          {resource.upgradeAvailable && resource.currentVersionNo && <ContentStatusBadge kind="outdated" number={resource.currentVersionNo} />}
          {resource.assetState === "archived" && <ContentStatusBadge kind="archived" />}
          {!resource.url && <Text as="span" variant="bodyXs" tone="critical">{tx("contentModel.integration.sceneLibrary.missing")}</Text>}
        </>, () => onSelectAlias(alias)) : null)}
        {!inScene.length && empty("contentModel.integration.sceneLibrary.emptyScene")}
        <Text as="p" variant="bodyXs" tone="subdued" className="px-2 pt-2">{tx("contentModel.integration.sceneLibrary.pinnedHint")}</Text>
      </> : <>
        {status === "loading" && <div className="flex justify-center py-4"><LoaderCircle className="size-4 animate-spin text-muted-foreground" /></div>}
        {items.map((resource) => row(resource, resource.assetVersionId!))}
        {status === "ready" && !items.length && empty("contentModel.integration.sceneLibrary.emptyTeam")}
        {(status === "ready" || status === "more") && loaded < total && <Button variant="ghost" size="sm" className="mt-1 w-full" disabled={status === "more"} onClick={() => void load(loaded)}>{tx("contentModel.integration.sceneLibrary.loadMore")}</Button>}
      </>}
    </div>
  </section>;
}
