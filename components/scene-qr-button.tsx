"use client";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getOrCreateSceneQRCode } from "@/app/manage/actions/wechat-qr";
import { WeChatQrButton } from "./wechat-qr-button";
import { useWeChatQrEnvironment } from "@/hooks/use-wechat-qr-environment";
export function SceneQrButton({ sceneId, dirty = false }: { sceneId: string; dirty?: boolean }) {
  const { t } = useTranslation();
  const [environment] = useWeChatQrEnvironment();
  const load = useCallback(() => getOrCreateSceneQRCode(sceneId, environment), [sceneId, environment]);
  const version = t(`admin.settings.wechatQr.versions.${environment}`);
  return <WeChatQrButton key={`${sceneId}:${environment}`} label={t("sceneEditor.qrButton")} title={t("sceneEditor.qrTitle")} description={`${t("admin.settings.wechatQr.currentVersion", { version })} ${t(dirty ? "sceneEditor.qrUnsaved" : "sceneEditor.qrHint")}`} load={load} />;
}
