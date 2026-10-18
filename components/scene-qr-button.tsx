"use client";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getOrCreateSceneQRCode } from "@/app/manage/actions/wechat-qr";
import { WeChatQrButton } from "./wechat-qr-button";
export function SceneQrButton({ sceneId, dirty = false }: { sceneId: string; dirty?: boolean }) {
  const { t } = useTranslation();
  const load = useCallback(() => getOrCreateSceneQRCode(sceneId), [sceneId]);
  return <WeChatQrButton key={sceneId} label={t("sceneEditor.qrButton")} title={t("sceneEditor.qrTitle")} description={t(dirty ? "sceneEditor.qrUnsaved" : "sceneEditor.qrHint")} load={load} />;
}
