"use client";
import Link from "next/link";
import { Box, ExternalLink, Film, ImageIcon, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { useTranslation } from "react-i18next";
import type { SceneResource } from "./types";

export function SceneResourceSource({ resource, assetHref }: { resource: SceneResource; assetHref: string }) {
  const { t } = useTranslation();
  const Icon = ({ image: ImageIcon, audio: Music2, video: Film, model: Box })[resource.kind ?? "model"];
  return <div className="space-y-2">
    <div className="flex min-w-0 items-center gap-2"><Icon className="size-4 shrink-0 text-muted-foreground" />
    <Text as="h3" variant="bodySm" fontWeight="medium" truncate className="min-w-0 flex-1" title={resource.name ?? undefined}>{resource.name || "—"}</Text>
      <Button asChild size="icon" variant="ghost" className="size-8 shrink-0"><Link target="_blank" rel="noopener noreferrer" href={assetHref} title={t("contentModel.edit.openAsset")} aria-label={t("contentModel.edit.openAsset")}><ExternalLink /></Link></Button>
    </div>
    {resource.assetState === "archived" && <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.detail.archivedBody")}</Text>}
  </div>;
}
