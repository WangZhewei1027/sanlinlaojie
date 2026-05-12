"use client";

import { useEffect, useState } from "react";
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
import { getOrCreateWorkspaceQRCode } from "@/app/manage/actions/wechat-qr";

export function WorkspaceQrButton() {
  const { t } = useTranslation();
  const selectedOrganizationId = useManageStore(
    (state) => state.selectedOrganizationId,
  );
  const selectedWorkspaceId = useManageStore(
    (state) => state.selectedWorkspaceId,
  );

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset cached image whenever the (org, workspace) context changes.
  useEffect(() => {
    setUrl(null);
    setError(null);
  }, [selectedOrganizationId, selectedWorkspaceId]);

  if (!selectedOrganizationId) return null;

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next || url || loading) return;
    setLoading(true);
    setError(null);
    const result = await getOrCreateWorkspaceQRCode({
      organizationId: selectedOrganizationId,
      workspaceId: selectedWorkspaceId,
    });
    if (result.error) {
      setError(result.error);
    } else if (result.url) {
      setUrl(result.url);
    }
    setLoading(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
          {loading && (
            <>
              <Skeleton className="h-56 w-56" />
              <p className="text-xs text-muted-foreground">
                {t("workspace.qrLoading", "Generating...")}
              </p>
            </>
          )}
          {!loading && error && (
            <p className="text-xs text-destructive text-center break-all">
              {t("workspace.qrError", "Failed to load QR code")}: {error}
            </p>
          )}
          {!loading && !error && url && (
            <Image
              src={url}
              alt={t("workspace.qrButton", "Show QR Code")}
              width={224}
              height={224}
              unoptimized
              className="h-56 w-56 rounded"
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
