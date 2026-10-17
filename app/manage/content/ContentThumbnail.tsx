"use client";

import { Box, FileText, Link2, Video, type LucideIcon } from "lucide-react";
import { AssetThumbnail } from "../components/AssetManager/AssetThumbnail";
import type { ContentAssetType } from "./types";

const ICON_TYPES: Partial<Record<ContentAssetType, LucideIcon>> = {
  model: Box,
  video: Video,
  link: Link2,
  document: FileText,
};

export interface ContentThumbnailProps {
  type: ContentAssetType;
  name: string;
  thumbnailUrl?: string | null;
  textExcerpt?: string | null;
}

/**
 * Reuses the asset manager thumbnail for image, audio and text, and adds a
 * matching icon tile for types it does not draw. A supplied poster or model
 * snapshot always wins over the icon.
 */
export function ContentThumbnail({ type, name, thumbnailUrl, textExcerpt }: ContentThumbnailProps) {
  const Icon = ICON_TYPES[type];
  if (Icon && !thumbnailUrl) {
    return (
      <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted" aria-hidden>
        <Icon className="size-7 text-muted-foreground" />
      </div>
    );
  }
  return (
    <AssetThumbnail
      fileType={thumbnailUrl ? "image" : type}
      fileUrl={thumbnailUrl}
      textContent={textExcerpt}
      fileName={name}
    />
  );
}
