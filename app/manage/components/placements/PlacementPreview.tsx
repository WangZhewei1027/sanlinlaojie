"use client";

import type { PlacementDto } from "@/lib/content-model/contracts";
import { Text } from "@/components/ui/typography";
import { parseLinkAssetInput, type LinkAssetData } from "@/lib/link-asset";
import { AssetAudioPreview, AssetImagePreview, AssetLinkPreview, AssetModelPreview, AssetVideoPreview } from "../AssetEditor/previews";
import { assetContentOf, placementDisplayName, placementScopeKey, resolvedContentOf } from "../../lib/placement-to-viewer";
import { usePlacementStore } from "../../lib/placement-store";
import { usePlacementMap } from "./PlacementMapContext";

function linkDataOf(url: string, preview: Record<string, unknown> | undefined): LinkAssetData | null {
  const previewUrl = preview?.preview_url;
  const linkType = preview?.link_type;
  if (typeof previewUrl === "string" && (linkType === "figma" || linkType === "iframe" || linkType === "url")) {
    return { originalUrl: url, previewUrl, linkType };
  }
  try {
    return parseLinkAssetInput(url);
  } catch {
    return null;
  }
}

/** Read-only preview of the asset content used by the placement. */
export function PlacementPreview({ placement }: { placement: PlacementDto }) {
  const { tx, organizationId, workspaceId } = usePlacementMap();
  const contents = usePlacementStore((state) => state.placementContents);
  const scopeKey = placementScopeKey(organizationId, workspaceId);
  if (placement.target.kind === "scene") return null;
  const version = assetContentOf(placement, contents, scopeKey);
  if (!version) return <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.map.source.previewUnavailable")}</Text>;

  const name = placementDisplayName(placement);
  const url = resolvedContentOf(placement, contents, scopeKey).url;
  const payload = version.payload;
  switch (payload.kind) {
    case "image":
    case "anchor":
      return url ? <AssetImagePreview fileUrl={url} fileName={name} /> : null;
    case "audio":
      return url ? <AssetAudioPreview key={url} fileUrl={url} fileName={name} /> : null;
    case "video":
      return url ? <AssetVideoPreview key={url} fileUrl={url} fileName={name} /> : null;
    case "model":
      return url ? <AssetModelPreview fileUrl={url} fileName={name} /> : null;
    case "link": {
      const data = linkDataOf(payload.url, payload.preview);
      return data ? <AssetLinkPreview linkData={data} fileName={name} /> : <Text as="p" variant="bodySm" breakWord>{payload.url}</Text>;
    }
    case "text":
      return <div className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm">{payload.text}</div>;
    case "document":
      return url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
          {tx("contentModel.integration.map.source.openDocument")}
        </a>
      ) : null;
    default:
      return null;
  }
}
