"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QrCode } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useManageStore } from "@/app/manage/store";
import { isSpecificWorkspaceId } from "@/app/manage/constants";
import { getOrCreateWorkspaceQRCode } from "@/app/manage/actions/wechat-qr";
import { buildQrPublicUrl } from "@/lib/wechat-qr";

// URLs confirmed to load, keyed by `${orgId}__${workspaceId}`. Module-level so
// switching org/workspace back and forth never refetches within a page session.
const confirmedQrUrls = new Map<string, string>();

export function WorkspaceQrButton() {
  const { t } = useTranslation();
  const selectedOrganizationId = useManageStore(
    (state) => state.selectedOrganizationId,
  );
  const selectedWorkspaceId = useManageStore(
    (state) => state.selectedWorkspaceId,
  );

  const workspaceId = isSpecificWorkspaceId(selectedWorkspaceId)
    ? selectedWorkspaceId
    : null;
  const cacheKey = `${selectedOrganizationId}__${workspaceId ?? "none"}`;

  const [open, setOpen] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against an onError → generate → onError loop: fall back to the
  // server action at most once per (org, workspace) context.
  const attemptedGenerate = useRef(false);

  // Reset per-context state when the (org, workspace) context changes.
  useEffect(() => {
    setGeneratedUrl(null);
    setLoaded(false);
    setError(null);
    attemptedGenerate.current = false;
  }, [cacheKey]);

  if (!selectedOrganizationId) return null;

  // Optimistic: the public URL is deterministic, so try loading it directly.
  // Cache hits cost zero server round trips; onError falls back to generating.
  const url =
    generatedUrl ??
    confirmedQrUrls.get(cacheKey) ??
    buildQrPublicUrl(selectedOrganizationId, workspaceId);

  const handleImageLoad = () => {
    setLoaded(true);
    confirmedQrUrls.set(cacheKey, url);
  };

  const handleImageError = async () => {
    if (generating) return;
    if (attemptedGenerate.current) {
      setError("");
      return;
    }
    attemptedGenerate.current = true;
    setGenerating(true);
    const result = await getOrCreateWorkspaceQRCode({
      organizationId: selectedOrganizationId,
      workspaceId,
    });
    if (result.error) {
      setError(result.error);
    } else if (result.url) {
      // Bust any cached error response for the URL that just 404'd.
      setGeneratedUrl(`${result.url}?v=${Date.now()}`);
    }
    setGenerating(false);
  };

  const showImage = open && !generating && error === null;
  const showSkeleton = !error && (generating || !loaded);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("workspace.qrButton", "Show QR Code")}
          className="ml-auto h-8 w-8"
        >
          <QrCode className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-64 p-3"
      >
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-center">
            {t("workspace.qrTitle", "Scan to enter mini-program")}
          </p>
          {showSkeleton && (
            <>
              <Skeleton className="h-56 w-56" />
              <p className="text-xs text-muted-foreground">
                {t("workspace.qrLoading", "Generating...")}
              </p>
            </>
          )}
          {error !== null && (
            <p className="text-xs text-destructive text-center break-all">
              {t("workspace.qrError", "Failed to load QR code")}
              {error ? `: ${error}` : ""}
            </p>
          )}
          {showImage && (
            <Image
              src={url}
              alt={t("workspace.qrButton", "Show QR Code")}
              width={224}
              height={224}
              unoptimized
              // Must be eager: while hidden (display:none) the img has no
              // layout box, so native lazy-loading would never fetch it and
              // neither onLoad nor onError would ever fire.
              loading="eager"
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={loaded ? "h-56 w-56 rounded" : "hidden"}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
