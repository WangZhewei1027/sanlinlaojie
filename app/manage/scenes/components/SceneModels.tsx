"use client";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Box, Layers3, Plus, Search, ChevronRight, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/typography";
import type { CompositionInstance } from "@/lib/scene/protocol";
import type { ModelAsset } from "./types";
import { MODEL_DRAG_TYPE } from "@/lib/scene/editor-interactions";

export interface SceneModelsProps {
  models: ModelAsset[]; instances: CompositionInstance[]; names: Record<string, string>; selectedId: string | null;
  canAdd: boolean; onAdd: (id: string) => void; onSelect: (id: string | null) => void;
  /** Replaces the built-in project model list (v2 scenes: in-scene / project / shared views). */
  library?: ReactNode;
}
export function SceneModels({ models, instances, names, selectedId, canAdd, onAdd, onSelect, library }: SceneModelsProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const filtered = models.filter((model) => (model.name ?? "").toLowerCase().includes(query.toLowerCase()));
  return <aside className="scene-left" aria-label={t("sceneEditor.hierarchy")}>
    <section className="scene-hierarchy">
      <div className="scene-panel-heading"><Layers3 className="size-3.5" /><Text as="h2" variant="bodyXs" fontWeight="semibold">{t("sceneEditor.hierarchy")}</Text><Text as="span" variant="bodyXs" tone="subdued" className="ml-auto tabular-nums">{instances.length} / 24</Text></div>
      <button className="scene-tree-root" onClick={() => onSelect(null)}><ChevronRight className="size-3 rotate-90" /><Film className="size-3.5" /><Text as="span" variant="bodyXs">{t("sceneEditor.scene")}</Text></button>
      <div className="scene-scroll" role="listbox" aria-label={t("sceneEditor.objects")}>
        {instances.map((instance) => <button role="option" aria-selected={selectedId === instance.id} key={instance.id} className="scene-object-row" onClick={() => onSelect(instance.id)}><Box className="size-3.5 shrink-0" /><Text as="span" variant="bodySm" truncate>{names[instance.id]}</Text>{instance.animation && <Film className="ml-auto size-3 shrink-0 text-muted-foreground" />}</button>)}
        {!instances.length && <div className="space-y-2 px-4 py-5"><Text as="p" variant="bodySm" tone="subdued">{t("sceneEditor.emptyHierarchy")}</Text><Text as="p" variant="bodySm" tone="subdued">{t("sceneEditor.addFromLibrary")}</Text></div>}
      </div>
    </section>
    {library ?? <section className="scene-library" aria-label={t("sceneEditor.library")}>
      <div className="scene-panel-heading"><Box className="size-3.5" /><Text as="h2" variant="bodyXs" fontWeight="semibold">{t("sceneEditor.library")}</Text><Text as="span" variant="bodyXs" tone="subdued" className="ml-auto">GLB</Text></div>
      <div className="relative m-2"><Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t("sceneEditor.searchModels")} placeholder={t("sceneEditor.searchModels")} className="h-8 pl-7 shadow-none" /></div>
      <div className="scene-scroll px-2 pb-2">
        {filtered.map((model) => <div key={model.id} className="scene-library-row" draggable={canAdd && !!model.file_url} title={t("sceneEditor.dragModel")} onDragStart={(event) => {
          if (!canAdd || !model.file_url || (event.target as HTMLElement).closest("button")) { event.preventDefault(); return; }
          event.dataTransfer.setData(MODEL_DRAG_TYPE, model.id); event.dataTransfer.effectAllowed = "copy";
        }}><Box className="size-5 shrink-0 text-muted-foreground" /><Text as="span" variant="bodySm" truncate className="min-w-0 flex-1" title={model.name ?? ""}>{model.name || t("sceneEditor.unnamedModel")}</Text><Button variant="ghost" size="icon" className="size-8" draggable={false} disabled={!canAdd || !model.file_url} aria-label={t("sceneEditor.addNamed", { name: model.name || t("sceneEditor.unnamedModel") })} title={t("sceneEditor.addModel")} onClick={() => onAdd(model.id)}><Plus /></Button></div>)}
        {!filtered.length && <Text as="p" variant="bodySm" tone="subdued" className="px-2 py-3">{t(query ? "sceneEditor.noResults" : "sceneEditor.noLibraryModels")}</Text>}
      </div>
      {!canAdd && <Text as="p" variant="bodySm" tone="warning" className="px-3 pb-3">{t("sceneEditor.instanceLimit")}</Text>}
    </section>}
  </aside>;
}
