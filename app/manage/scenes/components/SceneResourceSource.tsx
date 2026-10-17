"use client";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Text } from "@/components/ui/typography";
import { useTranslation } from "react-i18next";
import type { SceneResource } from "./types";

export function SceneResourceSource({ resource, assetHref }: { resource: SceneResource; assetHref: string }) {
  const { t } = useTranslation();
  return <div className="space-y-2 border-t pt-3">
    <Text as="h3" variant="bodySm" fontWeight="medium">{resource.name}</Text>
    <Text as="p" variant="bodyXs" tone="subdued">{t("contentModel.edit.liveReferences")}</Text>
    {resource.assetState === "archived" && <Text as="p" variant="bodyXs" tone="subdued">{t("contentModel.detail.archivedBody")}</Text>}
    <Link href={assetHref} className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"><ExternalLink className="size-3.5" aria-hidden />{t("contentModel.edit.openAsset")}</Link>
  </div>;
}
