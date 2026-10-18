"use client";

import { useEffect, useState } from "react";
import { Check, Clapperboard, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { SPECIAL_ASSET_FILE_TYPES, type AssetDto, type SceneSummaryDto } from "@/lib/content-model/contracts";
import { AssetThumbnail } from "../AssetManager/AssetThumbnail";
import { organizationApi } from "../../lib/content-api";
import { errorMessage } from "../../lib/content-errors";
import { excerptOf, thumbnailOf } from "../../lib/content-mappers";
import { usePlacementMap } from "./PlacementMapContext";
import type { PickedSource } from "./PlaceExistingForm";

const SEARCH_DELAY_MS = 300;

type Loaded<T> = { key: string; items: T[]; error: string | null };

/**
 * Picker over the whole team: every active asset (search, current version)
 * or every saved scene. The same scene may be placed in many collections.
 */
export function SourcePicker({ value, onChange }: { value: PickedSource | null; onChange: (value: PickedSource | null) => void }) {
  const { tx, organizationId } = usePlacementMap();
  const [kind, setKind] = useState<"asset" | "scene">("asset");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [assets, setAssets] = useState<Loaded<AssetDto> | null>(null);
  const [scenes, setScenes] = useState<Loaded<SceneSummaryDto> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const assetKey = `${organizationId}|${debounced}`;
  useEffect(() => {
    if (kind !== "asset") return;
    const abort = new AbortController();
    organizationApi
      .assets(organizationId, { view: "all", q: debounced || undefined, limit: 20, state: "active" }, abort.signal)
      .then((page) => setAssets({ key: assetKey, items: (page.data ?? []).filter((asset) => !SPECIAL_ASSET_FILE_TYPES.includes(asset.file_type)), error: null }))
      .catch((error) => !abort.signal.aborted && setAssets({ key: assetKey, items: [], error: errorMessage(error, tx) }));
    return () => abort.abort();
  }, [organizationId, kind, debounced, assetKey, tx]);

  useEffect(() => {
    if (kind !== "scene") return;
    const abort = new AbortController();
    organizationApi
      .scenes(organizationId, { state: "active" }, abort.signal)
      .then((list) => setScenes({ key: organizationId, items: list.items, error: null }))
      .catch((error) => !abort.signal.aborted && setScenes({ key: organizationId, items: [], error: errorMessage(error, tx) }));
    return () => abort.abort();
  }, [organizationId, kind, tx]);

  const current = kind === "asset" ? (assets?.key === assetKey ? assets : null) : scenes?.key === organizationId ? scenes : null;
  const switchKind = (next: "asset" | "scene") => {
    setKind(next);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2" role="group" aria-label={tx("contentModel.integration.map.create.sourceKind")}>
        {(["asset", "scene"] as const).map((option) => (
          <Button key={option} type="button" size="sm" variant={kind === option ? "secondary" : "ghost"} aria-pressed={kind === option} onClick={() => switchKind(option)}>
            {tx(`contentModel.integration.map.create.kind.${option}`)}
          </Button>
        ))}
      </div>
      {kind === "asset" && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx("contentModel.integration.map.create.searchAssets")} aria-label={tx("contentModel.integration.map.create.searchAssets")} className="ps-8" />
        </div>
      )}
      <div className="max-h-60 divide-y overflow-y-auto rounded-md border" role="listbox" aria-label={tx(`contentModel.integration.map.create.kind.${kind}`)}>
        {!current ? (
          <Text as="p" variant="bodySm" tone="subdued" className="p-3">{tx("contentModel.integration.map.list.loading")}</Text>
        ) : current.error ? (
          <Text as="p" variant="bodySm" tone="critical" className="p-3">{current.error}</Text>
        ) : current.items.length === 0 ? (
          <Text as="p" variant="bodySm" tone="subdued" className="p-3">{tx(kind === "asset" ? "contentModel.integration.map.create.noAssets" : "contentModel.integration.map.create.noScenes")}</Text>
        ) : kind === "asset" ? (
          (current.items as AssetDto[]).map((asset) => {
            const selected = value?.kind === "asset" && value.asset.id === asset.id;
            const name = asset.name || asset.id.slice(0, 8);
            return (
              <Row key={asset.id} selected={selected} onSelect={() => onChange({ kind: "asset", asset })}>
                <AssetThumbnail fileType={asset.file_type} fileUrl={thumbnailOf(asset)} textContent={excerptOf(asset)} fileName={name} />
                <RowText title={name} meta={tx(`contentModel.integration.map.type.${asset.file_type}`)} />
              </Row>
            );
          })
        ) : (
          (current.items as SceneSummaryDto[]).map((scene) => {
            const selected = value?.kind === "scene" && value.scene.id === scene.id;
            return (
              <Row key={scene.id} selected={selected} onSelect={() => onChange({ kind: "scene", scene })}>
                <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted"><Clapperboard className="size-6 text-muted-foreground" aria-hidden /></span>
                <RowText title={scene.name} meta={tx("contentModel.integration.map.source.liveScene")} />
              </Row>
            );
          })
        )}
      </div>
      {value && (
        <Text as="p" variant="bodyXs" tone="subdued">
          {value.kind === "asset"
            ? tx("contentModel.integration.map.source.liveAsset")
            : tx("contentModel.integration.map.source.liveScene")}
        </Text>
      )}
    </div>
  );
}

function Row({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn("flex w-full items-center gap-3 px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", selected ? "bg-primary/10" : "hover:bg-muted/50")}
    >
      {children}
      {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
    </button>
  );
}

function RowText({ title, meta }: { title: string; meta: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{title}</span>
      <span className="block truncate text-xs text-muted-foreground">{meta}</span>
    </span>
  );
}
