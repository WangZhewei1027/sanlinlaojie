"use client";

import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Focus, MapPin, MapPinOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { PlacementDto } from "@/lib/content-model/contracts";
import { ContentStatusBadge } from "@/app/manage/content/ContentStatusBadge";
import { AssetThumbnail } from "../AssetManager/AssetThumbnail";
import { isMappable, placementDisplayName, placementFileType, placementScopeKey, resolvedContentOf } from "../../lib/placement-to-viewer";
import { usePlacementStore } from "../../lib/placement-store";
import type { Tag } from "../../types";
import { usePlacementMap } from "./PlacementMapContext";

interface PlacementCardProps {
  placement: PlacementDto;
  tags: Tag[];
  selected: boolean;
  selectMode: boolean;
  checked: boolean;
  onSelect: (placement: PlacementDto) => void;
}

/** One placement row: identity, pinned version, status and discovery facts. */
export function PlacementCard({ placement, tags, selected, selectMode, checked, onSelect }: PlacementCardProps) {
  const { t } = useTranslation();
  const { tx, focusPlacement, workspaceName, organizationId, workspaceId } = usePlacementMap();
  const contents = usePlacementStore((state) => state.placementContents);
  const content = resolvedContentOf(placement, contents, placementScopeKey(organizationId, workspaceId));
  const name = placementDisplayName(placement);
  const type = placementFileType(placement);
  const target = placement.target;
  const versionLabel = target.kind === "asset_version" ? `v${target.version_no}` : `#${target.revision_no}`;
  const mappable = isMappable(placement);

  const focus = (event: MouseEvent) => {
    event.stopPropagation();
    focusPlacement(placement);
  };

  return (
    <div
      id={`placement-card-${placement.id}`}
      role="button"
      tabIndex={0}
      aria-pressed={selectMode ? checked : selected}
      onClick={() => onSelect(placement)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(placement);
        }
      }}
      className={cn(
        "flex cursor-pointer items-center gap-3 border-l px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        selected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/50",
      )}
    >
      {selectMode && <Checkbox checked={checked} tabIndex={-1} aria-hidden className="shrink-0" />}
      <AssetThumbnail fileType={type} fileUrl={content.url} textContent={content.text} fileName={name} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium leading-tight" title={name}>{name}</p>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary" className="px-1.5 py-0 text-xs">{tx(`contentModel.integration.map.type.${type}`)}</Badge>
          <span className="text-xs tabular-nums text-muted-foreground">{versionLabel}</span>
          {placement.status !== "active" && (
            <Badge variant="outline" className="px-1.5 py-0 text-xs">{t(`contentModel.placement.status.${placement.status}`)}</Badge>
          )}
          {target.upgrade_available && <ContentStatusBadge kind="outdated" />}
          {placement.capabilities.read_only_shared && (
            <Badge variant="outline" className="max-w-full truncate px-1.5 py-0 text-xs">
              {tx("contentModel.integration.map.card.sharedFrom", { project: placement.workspace_name ?? workspaceName(placement.workspace_id) })}
            </Badge>
          )}
          {placement.directory_only && <Badge variant="outline" className="px-1.5 py-0 text-xs">{tx("contentModel.integration.map.card.directoryOnly")}</Badge>}
        </div>
        {placement.tag_ids.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {placement.tag_ids.map((id) => {
              const tag = tags.find((item) => item.id === id);
              return tag ? <span key={id} className="size-2 rounded-full" style={{ backgroundColor: tag.color }} title={tag.name} /> : null;
            })}
          </div>
        )}
      </div>
      {mappable ? (
        <Button variant="ghost" size="sm" className="size-9 shrink-0 p-0 md:size-7" onClick={focus} aria-label={tx("contentModel.integration.map.card.focus")} title={tx("contentModel.integration.map.card.focus")}>
          <Focus className="size-4" aria-hidden />
        </Button>
      ) : (
        <span className="shrink-0 text-muted-foreground" title={tx("contentModel.integration.map.card.noLocation")}>
          {placement.directory_only ? <MapPinOff className="size-4" aria-hidden /> : <MapPin className="size-4 opacity-40" aria-hidden />}
          <span className="sr-only">{tx("contentModel.integration.map.card.noLocation")}</span>
        </span>
      )}
    </div>
  );
}
