"use client";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getOrCreateWorkspaceQRCode } from "@/app/manage/actions/wechat-qr";
import { isSpecificWorkspaceId } from "@/app/manage/constants";
import { WeChatQrButton } from "./wechat-qr-button";
import { useWeChatQrEnvironment } from "@/hooks/use-wechat-qr-environment";
export function WorkspaceQrButton({ organizationId, workspaceId: selected }: { organizationId: string; workspaceId: string | null }) {
  const { t } = useTranslation();
  const [environment] = useWeChatQrEnvironment();
  const workspaceId = isSpecificWorkspaceId(selected) ? selected : null;
  const load = useCallback(() => getOrCreateWorkspaceQRCode({ organizationId, workspaceId, environment }), [organizationId, workspaceId, environment]);
  if (!organizationId) return null;
  const version = t(`admin.settings.wechatQr.versions.${environment}`);
  return <WeChatQrButton key={`${organizationId}:${workspaceId}:${environment}`} label={t("workspace.qrButton")} title={t("workspace.qrTitle")} description={t("admin.settings.wechatQr.currentVersion", { version })} load={load} />;
}
