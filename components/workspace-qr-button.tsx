"use client";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getOrCreateWorkspaceQRCode } from "@/app/manage/actions/wechat-qr";
import { isSpecificWorkspaceId } from "@/app/manage/constants";
import { WeChatQrButton } from "./wechat-qr-button";
export function WorkspaceQrButton({ organizationId, workspaceId: selected }: { organizationId: string; workspaceId: string | null }) {
  const { t } = useTranslation();
  const workspaceId = isSpecificWorkspaceId(selected) ? selected : null;
  const load = useCallback(() => getOrCreateWorkspaceQRCode({ organizationId, workspaceId }), [organizationId, workspaceId]);
  if (!organizationId) return null;
  return <WeChatQrButton key={`${organizationId}:${workspaceId}`} label={t("workspace.qrButton")} title={t("workspace.qrTitle")} load={load} />;
}
