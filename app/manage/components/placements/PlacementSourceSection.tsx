"use client";

import Link from "next/link";
import { Anchor, ExternalLink, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import type { PlacementDto } from "@/lib/content-model/contracts";
import { ContentStatusBadge } from "@/app/manage/content/ContentStatusBadge";
import { FieldSection } from "../AssetEditor/FieldSection";
import { teamHref } from "../../lib/content-context";
import { placementFileType, placementScopeKey } from "../../lib/placement-to-viewer";
import { usePlacementStore } from "../../lib/placement-store";
import { usePlacementMap } from "./PlacementMapContext";
import { PlacementPreview } from "./PlacementPreview";
import { PlacementVersionSwitch } from "./PlacementVersionSwitch";

interface PlacementSourceSectionProps {
  placement: PlacementDto;
  editable: boolean;
  formDirty: boolean;
}

/**
 * Read-only facts about the content the placement plays: the source asset or
 * scene, the pinned version/revision, and where to maintain the source.
 */
export function PlacementSourceSection({ placement, editable, formDirty }: PlacementSourceSectionProps) {
  const { tx, organizationId, workspaceId } = usePlacementMap();
  const target = placement.target;
  const scopeKey = placementScopeKey(organizationId, workspaceId);
  const detail = usePlacementStore((state) => (state.scopeKey === scopeKey && target.kind === "asset_version" ? state.assetDetails[target.asset_id] : undefined));
  const canReadSource = target.kind === "scene_revision" || detail?.capabilities.can_read === true;
  const type = placementFileType(placement);
  const sourceArchived = target.kind === "asset_version" ? target.asset_state === "archived" : target.scene_state === "archived";
  const href = target.kind === "asset_version"
    ? teamHref(`/manage/assets/${target.asset_id}`, organizationId)
    : teamHref(`/manage/scenes/${target.scene_id}`, organizationId);
  const sourceName = (target.kind === "asset_version" ? target.asset_name : target.scene_name) || tx("contentModel.integration.map.source.unnamed");

  return (
    <FieldSection title={tx("contentModel.integration.map.section.source")} hint={tx("contentModel.integration.map.section.sourceHint")} icon={Package}>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Text as="p" variant="bodySm" fontWeight="medium" breakWord>{sourceName}</Text>
          <Badge variant="secondary" className="px-1.5 py-0 text-xs">{tx(`contentModel.integration.map.type.${type}`)}</Badge>
          {sourceArchived && <ContentStatusBadge kind="archived" />}
        </div>
        <Text as="p" variant="bodySm" tone="subdued">
          {target.kind === "asset_version"
            ? tx("contentModel.integration.map.source.pinnedVersion", { number: target.version_no })
            : tx("contentModel.integration.map.source.pinnedRevision", { number: target.revision_no })}
        </Text>
        {target.upgrade_available && (
          <ContentStatusBadge kind="outdated" number={target.kind === "asset_version" ? detail?.current_version_no ?? null : null} />
        )}
      </div>

      {canReadSource && <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={href}>
            <ExternalLink className="size-4" aria-hidden />
            {tx(target.kind === "asset_version" ? "contentModel.integration.map.source.openAsset" : "contentModel.integration.map.source.openScene")}
          </Link>
        </Button>
        {type === "anchor" && target.kind === "asset_version" && (
          <Button variant="ghost" size="sm" onClick={() => usePlacementStore.getState().selectAnchor(target.asset_id)}>
            <Anchor className="size-4" aria-hidden />
            {tx("contentModel.integration.map.source.openAnchor")}
          </Button>
        )}
      </div>}

      <PlacementPreview placement={placement} />
      <PlacementVersionSwitch placement={placement} editable={editable} formDirty={formDirty} />
    </FieldSection>
  );
}
