"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { ExternalLink } from "lucide-react";
import { Text } from "@/components/ui/typography";
import type { AssetVersionDto } from "@/lib/content-model/contracts";
import { AssetAudioPreview } from "@/app/manage/components/AssetEditor/previews/AssetAudioPreview";
import { AssetImagePreview } from "@/app/manage/components/AssetEditor/previews/AssetImagePreview";
import { AssetVideoPreview } from "@/app/manage/components/AssetEditor/previews/AssetVideoPreview";
import { primaryResource } from "@/app/manage/lib/content-mappers";
import type { IntegrationT } from "@/app/manage/lib/integration-text";

// three.js and the GLTF stack load only when a model is actually previewed.
const AssetModelPreview = dynamic(
  () => import("@/app/manage/components/AssetEditor/previews/AssetModelPreview").then((module) => module.AssetModelPreview),
  { ssr: false },
);

/** Whether AssetPreview renders anything; otherwise the header keeps its thumbnail. */
export function hasPreview(version: AssetVersionDto | null): version is AssetVersionDto {
  if (!version) return false;
  const kind = version.payload.kind;
  if (kind === "text" || kind === "link") return true;
  return ["image", "audio", "video", "model"].includes(kind) && !!primaryResource(version);
}

/**
 * Larger preview of one version for the detail header, reusing the asset
 * editor previews. Check `hasPreview` first.
 */
export function AssetPreview({ version, name, tx }: { version: AssetVersionDto | null; name: string; tx: IntegrationT }) {
  if (!version) return null;
  const payload = version.payload;
  const url = primaryResource(version)?.url ?? null;
  const frame = (child: ReactNode) => <div className="w-full md:w-72">{child}</div>;

  if (payload.kind === "text") {
    return frame(
      <div className="space-y-1.5">
        <Text as="p" variant="bodyXs" tone="subdued">{tx("contentModel.integration.assetDetail.text")}</Text>
        <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 px-3 py-2 text-sm">{payload.text}</div>
      </div>,
    );
  }
  if (payload.kind === "link") {
    return frame(
      <div className="space-y-1.5">
        <Text as="p" variant="bodyXs" tone="subdued">{tx("contentModel.integration.assetDetail.link")}</Text>
        <a href={payload.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline">
          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{payload.title || payload.url}</span>
        </a>
      </div>,
    );
  }
  if (!url) return null;
  if (payload.kind === "image") return frame(<AssetImagePreview fileUrl={url} fileName={name} />);
  if (payload.kind === "audio") return frame(<AssetAudioPreview fileUrl={url} fileName={name} />);
  if (payload.kind === "video") return frame(<AssetVideoPreview fileUrl={url} fileName={name} />);
  if (payload.kind === "model") return frame(<AssetModelPreview fileUrl={url} fileName={name} />);
  return null;
}
