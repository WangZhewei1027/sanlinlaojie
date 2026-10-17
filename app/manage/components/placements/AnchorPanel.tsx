"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import { MatchingPointPanel } from "../AssetEditor/MatchingPointPanel";
import { useMatchingStatus } from "../AssetEditor/hooks/useMatchingStatus";
import { placementApi } from "../../lib/content-api";
import { contextHref } from "../../lib/content-context";
import { errorMessage } from "../../lib/content-errors";
import { primaryResource } from "../../lib/content-mappers";
import { isMappable, placementDisplayName, placementFileType } from "../../lib/placement-to-viewer";
import { usePlacementStore } from "../../lib/placement-store";
import { anchorPlacementOf } from "./AnchorList";
import { usePlacementMap } from "./PlacementMapContext";

const noop = () => {};

/**
 * Recognition target (anchor asset) panel. Reuses the legacy matching-point
 * panel and status hook (`/api/assets/[id]/matching` stays anchor-specific);
 * "attached content" are placements whose `anchor_id` is this anchor.
 * Replacing the reference image is a new asset version (asset library).
 */
export function AnchorPanel({ anchorId }: { anchorId: string }) {
  const { tx, organizationId, workspaceId, anchors, workspaceCanEdit, canWrite, focusPlacement } = usePlacementMap();
  const placements = usePlacementStore((state) => state.placements);
  const anchor = anchors.find((item) => item.id === anchorId) ?? null;
  const imageUrl = primaryResource(anchor?.current_version)?.url ?? null;
  const matching = useMatchingStatus(anchorId, imageUrl, false);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapPlacement = anchorPlacementOf(anchorId, placements);
  const children = useMemo(() => placements.filter((placement) => placement.anchor_id === anchorId && placement.status !== "archived"), [placements, anchorId]);
  const available = useMemo(
    () => placements.filter((placement) => !placement.anchor_id && placement.status !== "archived" && canWrite(placement) && !["anchor", "shop"].includes(placementFileType(placement))),
    [placements, canWrite],
  );

  const attach = async (placementId: string, next: string | null) => {
    const placement = placements.find((item) => item.id === placementId);
    if (!placement || !canWrite(placement)) {
      setError(tx("contentModel.integration.map.anchors.childReadOnly"));
      return;
    }
    setAttaching(true);
    setError(null);
    try {
      const updated = await placementApi.update(placement.id, { expectedLockVersion: placement.lock_version, anchorId: next });
      usePlacementStore.getState().upsertPlacements([updated]);
    } catch (failure) {
      setError(errorMessage(failure, tx));
    } finally {
      setAttaching(false);
    }
  };

  const label = (placement: (typeof placements)[number]) => ({ id: placement.id, name: placementDisplayName(placement) });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/20 p-4">
        <div className="min-w-0 flex-1">
          <Text as="h3" variant="bodySm" fontWeight="semibold" truncate>{tx("contentModel.integration.map.anchors.panelTitle")}</Text>
          <Text as="p" variant="bodyXs" tone="subdued" truncate>{anchor?.name || tx("contentModel.integration.map.anchors.unnamed")}</Text>
        </div>
        <Button variant="ghost" size="sm" onClick={() => usePlacementStore.getState().selectAnchor(null)} aria-label={tx("contentModel.integration.map.action.close")}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="space-y-4 p-4">
        {!anchor && <ContentNotice title={tx("contentModel.integration.map.anchors.missing")} />}
        <div className="flex flex-wrap gap-2">
          {mapPlacement && isMappable(mapPlacement) ? (
            <Button size="sm" variant="outline" onClick={() => focusPlacement(mapPlacement)}>
              <MapPin className="size-4" aria-hidden />
              {tx("contentModel.integration.map.anchors.openPlacement")}
            </Button>
          ) : (
            <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.map.anchors.notOnMap")}</Text>
          )}
          <Button size="sm" variant="ghost" asChild>
            <Link href={contextHref(`/manage/assets/${anchorId}`, { organizationId, workspaceId })}>
              <ExternalLink className="size-4" aria-hidden />
              {tx("contentModel.integration.map.source.openAsset")}
            </Link>
          </Button>
        </div>
        <MatchingPointPanel
          imageUrl={imageUrl}
          imageFile={null}
          isEditing={false}
          status={matching.status}
          updatedAt={matching.updatedAt}
          statusError={matching.error}
          onRefresh={matching.refresh}
          error={error}
          canManage={workspaceCanEdit && !!anchor}
          childrenAssets={children.map(label)}
          availableAssets={available.map(label)}
          attaching={attaching}
          onImageSelect={noop}
          onImageRemove={noop}
          onRebuild={matching.rebuild}
          onAttach={(id) => void attach(id, anchorId)}
          onDetach={(id) => void attach(id, null)}
        />
      </div>
    </Card>
  );
}
