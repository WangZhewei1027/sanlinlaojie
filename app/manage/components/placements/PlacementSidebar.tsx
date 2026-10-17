"use client";

import { MousePointerClick, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import { usePlacementStore } from "../../lib/placement-store";
import { AnchorPanel } from "./AnchorPanel";
import { PlacementClickedLocation } from "./PlacementClickedLocation";
import { PlacementCreatePanel } from "./PlacementCreatePanel";
import { PlacementEditor } from "./PlacementEditor";
import { usePlacementMap } from "./PlacementMapContext";

/** Right column of the v2 map: scope notices, clicked location, editor, create. */
export function PlacementSidebar() {
  const { tx, isAll, workspaceId, workspaceCanEdit, workspaceInfoLoading } = usePlacementMap();
  const selectedId = usePlacementStore((state) => state.selectedPlacementId);
  const anchorId = usePlacementStore((state) => state.selectedAnchorId);
  const placement = usePlacementStore((state) => state.placements.find((item) => item.id === state.selectedPlacementId) ?? null);
  const notice = usePlacementStore((state) => state.notice);
  const canCreate = !isAll && !!workspaceId && workspaceCanEdit;

  return (
    <div className="h-full w-full overflow-hidden bg-background">
      <div className="h-full space-y-4 overflow-y-auto">
        {isAll && (
          <ContentNotice title={tx("contentModel.integration.map.scope.allTitle")} description={tx("contentModel.integration.map.scope.allBody")} />
        )}
        {!isAll && workspaceId && !workspaceInfoLoading && !workspaceCanEdit && (
          <ContentNotice title={tx("contentModel.integration.map.scope.readOnlyTitle")} description={tx("contentModel.integration.map.scope.readOnlyBody")} />
        )}
        {notice && (
          <ContentNotice
            tone={notice.tone}
            title={notice.message}
            action={
              <Button variant="ghost" size="sm" onClick={() => usePlacementStore.getState().setNotice(null)} aria-label={tx("contentModel.integration.map.action.dismiss")}>
                <X className="size-4" aria-hidden />
              </Button>
            }
          />
        )}
        <PlacementClickedLocation />
        {anchorId ? (
          <AnchorPanel key={anchorId} anchorId={anchorId} />
        ) : placement ? (
          <PlacementEditor key={placement.id} placement={placement} />
        ) : selectedId ? null : (
          <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <MousePointerClick className="size-8 text-muted-foreground/60" aria-hidden />
            <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.map.sidebar.selectHint")}</Text>
          </Card>
        )}
        {canCreate && <PlacementCreatePanel />}
      </div>
    </div>
  );
}
