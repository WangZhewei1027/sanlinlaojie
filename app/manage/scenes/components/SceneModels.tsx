"use client";
import { Text } from "@/components/ui/typography";
import type { CompositionInstance } from "@/lib/scene/protocol";
import { Box, ChevronRight, Film, Layers3 } from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface SceneModelsProps {
  instances: CompositionInstance[]; names: Record<string, string>; selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Replaces the built-in project model list (scenes: in-scene / project / shared views). */
  library: ReactNode;
}
export function SceneModels({ instances, names, selectedId, onSelect, library }: SceneModelsProps) {
  const { t } = useTranslation();
  return <aside className="scene-left" aria-label={t("sceneEditor.hierarchy")}>
    <section className="scene-hierarchy">
      <div className="scene-panel-heading"><Layers3 className="size-3.5" /><Text as="h2" variant="bodyXs" fontWeight="semibold">{t("sceneEditor.hierarchy")}</Text><Text as="span" variant="bodyXs" tone="subdued" className="ml-auto tabular-nums">{instances.length} / 24</Text></div>
      <button className="scene-tree-root" onClick={() => onSelect(null)}><ChevronRight className="size-3 rotate-90" /><Film className="size-3.5" /><Text as="span" variant="bodyXs">{t("sceneEditor.scene")}</Text></button>
      <div className="scene-scroll" role="listbox" aria-label={t("sceneEditor.objects")}>
        {instances.map((instance) => <button role="option" aria-selected={selectedId === instance.id} key={instance.id} className="scene-object-row" onClick={() => onSelect(instance.id)}><Box className="size-3.5 shrink-0" /><Text as="span" variant="bodySm" truncate>{names[instance.id]}</Text>{instance.animation && <Film className="ml-auto size-3 shrink-0 text-muted-foreground" />}</button>)}
        {!instances.length && <div className="space-y-2 px-4 py-5"><Text as="p" variant="bodySm" tone="subdued">{t("sceneEditor.emptyHierarchy")}</Text><Text as="p" variant="bodySm" tone="subdued">{t("sceneEditor.addFromLibrary")}</Text></div>}
      </div>
    </section>
    {library}
  </aside>;
}
