"use client";
import { ContentStatusBadge } from "@/app/manage/content/ContentStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import { MODEL_DRAG_TYPE } from "@/lib/scene/editor-interactions";
import { Box, Plus } from "lucide-react";
import { useIntegrationText } from "../../lib/integration-text";
import { SCENE_LIBRARY_TEXTS } from "./scene-library-texts";
import type { InSceneEntry } from "./SceneLibraryPanel";
import type { SceneResource } from "./types";

export interface SceneLibraryListProps {
  view: "scene" | "team"; inScene: InSceneEntry[]; items: SceneResource[];
  selectedAlias?: string; canAdd: boolean; search: string; loading: boolean; failed?: boolean;
  onRegister: (resource: SceneResource) => void; onAdd: (resource: SceneResource) => void;
  onSelectAlias: (alias: string) => void;
}
export function SceneLibraryList(props: SceneLibraryListProps) {
  const tx = useIntegrationText(SCENE_LIBRARY_TEXTS);
  const entries = props.view === "scene" ? props.inScene : props.items.map((resource) => ({ alias: resource.assetId, resource, instanceCount: 0 }));
  return <div className="scene-library-list px-2 pb-3">
    {props.loading && <div role="status" className="space-y-3 px-1 py-2"><span className="sr-only">{tx("contentModel.integration.sceneLibrary.loading")}</span>{[0, 1, 2].map((key) => <div key={key} className="flex items-center gap-2"><Skeleton className="size-8" /><Skeleton className="h-4 flex-1" /></div>)}</div>}
    {!props.loading && !props.failed && !entries.length && <Text as="p" variant="bodySm" tone="subdued" className="px-1 py-3">{tx(props.search && props.view === "team" ? "contentModel.integration.sceneLibrary.noResults" : props.view === "scene" ? "contentModel.integration.sceneLibrary.emptyScene" : "contentModel.integration.sceneLibrary.emptyTeam")}</Text>}
    {entries.map(({ alias, resource, instanceCount }) => {
      if (!resource) return null;
      const name = resource.name || "—";
      const draggable = props.canAdd && !!resource.url && !!resource.assetId;
      const selected = props.view === "scene" && props.selectedAlias === alias;
      const content = <><Text as="span" variant="bodySm" truncate className="block" title={name}>{name}</Text><span className="flex flex-wrap items-center gap-1.5">
        {props.view === "scene" && <Text as="span" variant="bodyXs" tone="subdued">{tx("contentModel.integration.sceneLibrary.instances", { count: instanceCount })}</Text>}
        {resource.assetState === "archived" && <ContentStatusBadge kind="archived" />}
        {!resource.url && <Text as="span" variant="bodyXs" tone="critical">{tx("contentModel.integration.sceneLibrary.missing")}</Text>}
      </span></>;
      return <div key={alias} className="scene-library-row" data-selected={selected || undefined} draggable={draggable} title={tx("contentModel.integration.sceneLibrary.drag")} onDragStart={(event) => {
        if (!draggable || (event.target as HTMLElement).closest("button")) { event.preventDefault(); return; }
        props.onRegister(resource); event.dataTransfer.setData(MODEL_DRAG_TYPE, resource.assetId); event.dataTransfer.effectAllowed = "copy";
      }}>
        <Box className="size-4 shrink-0 text-muted-foreground" />
        {props.view === "scene" ? <button type="button" className="min-w-0 flex-1 rounded-sm text-start" aria-pressed={selected} onClick={() => props.onSelectAlias(alias)}>{content}</button> : <div className="min-w-0 flex-1">{content}</div>}
        <Button variant="ghost" size="icon" className="size-8 shrink-0" draggable={false} disabled={!draggable} aria-label={tx("contentModel.integration.sceneLibrary.add", { name })} title={tx("contentModel.integration.sceneLibrary.add", { name })} onClick={() => props.onAdd(resource)}><Plus /></Button>
      </div>;
    })}
  </div>;
}
