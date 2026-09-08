"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { LinkAssetData } from "@/lib/link-asset";

interface AssetLinkPreviewProps {
  linkData: LinkAssetData;
  fileName?: string;
  compact?: boolean;
}

type PreviewStatus = "loading" | "loaded" | "error" | "timeout";

const PREVIEW_TIMEOUT_MS = 12_000;

export function AssetLinkPreview({
  linkData,
  fileName,
  compact = false,
}: AssetLinkPreviewProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PreviewStatus>("loading");

  useEffect(() => {
    setStatus("loading");
    const timeout = window.setTimeout(() => {
      setStatus((current) => (current === "loading" ? "timeout" : current));
    }, PREVIEW_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [linkData.previewUrl]);

  const failed = status === "error" || status === "timeout";
  const errorKey =
    status === "timeout"
      ? "linkAsset.errors.loadTimeout"
      : "linkAsset.errors.embedBlocked";

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative overflow-hidden rounded-md border bg-background",
          compact ? "min-h-64" : "min-h-[20rem]",
        )}
      >
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-muted/80">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <Text as="p" variant="bodySm" tone="subdued">
              {t("linkAsset.preview.loading")}
            </Text>
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/90 p-6 text-center">
            <TriangleAlert className="h-6 w-6 text-warning" />
            <Text as="p" variant="bodySm" tone="critical">
              {t(errorKey)}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {t("linkAsset.preview.openFallback")}
            </Text>
          </div>
        )}

        <iframe
          key={linkData.previewUrl}
          src={linkData.previewUrl}
          title={fileName || t("assetEditor.preview.link")}
          className={cn("w-full border-0", compact ? "h-64" : "h-[400px]")}
          sandbox={
            linkData.linkType === "figma"
              ? "allow-forms allow-popups allow-same-origin allow-scripts"
              : "allow-forms allow-popups allow-scripts"
          }
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen"
          allowFullScreen
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
          title={linkData.originalUrl}
        >
          {linkData.originalUrl}
        </p>
        <Button variant="outline" size="sm" asChild>
          <a
            href={linkData.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("linkAsset.preview.openOriginal")}
          </a>
        </Button>
      </div>

      {status === "loaded" && (
        <div className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 p-2">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <Text as="p" variant="bodySm" tone="warning">
            {t("linkAsset.preview.blockedHint")}
          </Text>
        </div>
      )}
    </div>
  );
}
