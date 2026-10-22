"use client";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import type { SceneDetailDto } from "@/lib/content-model/contracts";
import dynamic from "next/dynamic";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isContentApiError, sceneApi } from "../../lib/content-api";
import { contextHref, useResourceTeam, useTeamContext } from "../../lib/content-context";
import { ERROR_TEXTS, errorMessage } from "../../lib/content-errors";
import { useIntegrationText, type IntegrationTexts } from "../../lib/integration-text";
import "./scene-workspace-theme.css";
const SceneEditor = dynamic(() => import("./SceneEditor"), { ssr: false });

const TEXTS: IntegrationTexts = {
  ...ERROR_TEXTS,
  "contentModel.integration.sceneRoute.notFound": ["场景不存在，或你无权访问。", "The scene does not exist or you cannot access it."],
  "contentModel.integration.sceneRoute.back": ["返回场景", "Back to scenes"],
};

type Probe = { mode: "loaded"; detail: SceneDetailDto } | { mode: "missing" } | { mode: "error"; error: unknown };

/** Load the standalone scene and resolve its owning team. */
export function SceneEditorRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const tx = useIntegrationText(TEXTS);
  const context = useTeamContext();
  const [probe, setProbe] = useState<Probe | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setProbe(null);
    sceneApi.get(id, abort.signal).then((detail) => setProbe({ mode: "loaded", detail })).catch((error) => {
      if (abort.signal.aborted) return;
      setProbe(isContentApiError(error) && error.status === 404 ? { mode: "missing" } : { mode: "error", error });
    });
    return () => abort.abort();
    // Only the id or an explicit retry may re-probe: re-probing unmounts the editor and its local draft.
  }, [id, attempt]);

  const resolved = probe;
  // A scene's team drives the URL and header before the editor mounts; once
  // settled the editor is never unmounted by this guard (its local draft stays).
  const { settled } = useResourceTeam(resolved?.mode === "loaded" ? resolved.detail.organization_id : null, "/manage/scenes");
  const scenesHref = contextHref("/manage/scenes", { organizationId: resolved?.mode === "loaded" ? resolved.detail.organization_id : context.organizationId });


  if (!resolved || resolved.mode === "error" || resolved.mode === "missing" || (resolved.mode === "loaded" && !settled)) {
    return <main className="scene-workspace-theme scene-editor-status fixed inset-0 z-50 flex items-center justify-center bg-background"><div className="max-w-lg space-y-4 p-6">
      <Text as="h1" variant="headingMd">{t("sceneEditor.heading")}</Text>
      <Text as="p" variant="bodyMd" tone={resolved && resolved.mode !== "loaded" ? "critical" : "subdued"}>{!resolved || resolved.mode === "loaded" ? t("sceneEditor.loading") : resolved.mode === "missing" ? tx("contentModel.integration.sceneRoute.notFound") : errorMessage(resolved.error, tx)}</Text>
      {resolved && resolved.mode !== "loaded" && <div className="flex gap-2">{resolved.mode === "error" && <Button onClick={() => setAttempt((n) => n + 1)}>{t("sceneEditor.retry")}</Button>}<Button variant="outline" asChild><Link href={scenesHref}>{tx("contentModel.integration.sceneRoute.back")}</Link></Button></div>}
    </div></main>;
  }
  return <SceneEditor key={id} sceneId={id} initial={resolved.detail} organizationId={resolved.detail.organization_id} />;
}
