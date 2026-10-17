"use client";
import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import type { SceneDetailDto } from "@/lib/content-model/contracts";
import { isContentApiError, isEndpointMissing, sceneApi } from "../../lib/content-api";
import { contextHref, useContentContext, useContentModel, useResourceTeam } from "../../lib/content-context";
import { ERROR_TEXTS, errorMessage } from "../../lib/content-errors";
import { useIntegrationText, type IntegrationTexts } from "../../lib/integration-text";
const SceneEditor = dynamic(() => import("./SceneEditor"), { ssr: false });

const TEXTS: IntegrationTexts = {
  ...ERROR_TEXTS,
  "contentModel.integration.sceneRoute.notFound": ["场景不存在，或你无权访问。", "The scene does not exist or you cannot access it."],
  "contentModel.integration.sceneRoute.back": ["返回工作台", "Back to workbench"],
};

type Probe = { mode: "v2"; detail: SceneDetailDto } | { mode: "legacy" } | { mode: "missing" } | { mode: "error"; error: unknown };

/**
 * Picks the data source for one scene id: the standalone scene API (v2) when
 * it knows the scene, otherwise the asset-backed legacy editor — but only for
 * organizations that have not been cut over, so an old scene id can never be
 * edited through the legacy asset path once v2 is the source of truth.
 */
export function SceneEditorRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const tx = useIntegrationText(TEXTS);
  const context = useContentContext();
  const model = useContentModel(context.organizationId);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    setProbe(null);
    sceneApi.get(id, abort.signal).then((detail) => setProbe({ mode: "v2", detail })).catch((error) => {
      if (abort.signal.aborted) return;
      const legacyCandidate = isEndpointMissing(error) || (isContentApiError(error) && (error.code === "NOT_FOUND" || error.code === "CONTENT_MODEL_NOT_ENABLED"));
      setProbe(legacyCandidate ? { mode: "legacy" } : { mode: "error", error });
    });
    return () => abort.abort();
    // Only the id or an explicit retry may re-probe: re-probing unmounts the editor and its local draft.
  }, [id, attempt]);

  const resolved: Probe | null = probe?.mode === "legacy"
    ? (context.organizationId ? model.status === "loading" : context.loading) ? null : model.state === "v2" ? { mode: "missing" } : probe
    : probe;
  // A v2 scene's team drives the URL and header before the editor mounts; once
  // settled the editor is never unmounted by this guard (its local draft stays).
  const { settled } = useResourceTeam(resolved?.mode === "v2" ? resolved.detail.organization_id : null, "/manage");
  const scenesHref = contextHref("/manage", { organizationId: resolved?.mode === "v2" ? resolved.detail.organization_id : context.organizationId }, { type: "scene" });

  if (!resolved || resolved.mode === "error" || resolved.mode === "missing" || (resolved.mode === "v2" && !settled)) {
    return <main className="scene-editor-status fixed inset-0 z-50 flex items-center justify-center bg-background"><div className="max-w-lg space-y-4 p-6">
      <Text as="h1" variant="headingMd">{t("sceneEditor.heading")}</Text>
      <Text as="p" variant="bodyMd" tone={resolved && resolved.mode !== "v2" ? "critical" : "subdued"}>{!resolved || resolved.mode === "v2" ? t("sceneEditor.loading") : resolved.mode === "missing" ? tx("contentModel.integration.sceneRoute.notFound") : errorMessage(resolved.error, tx)}</Text>
      {resolved && resolved.mode !== "v2" && <div className="flex gap-2">{resolved.mode === "error" && <Button onClick={() => setAttempt((n) => n + 1)}>{t("sceneEditor.retry")}</Button>}<Button variant="outline" asChild><Link href={scenesHref}>{tx("contentModel.integration.sceneRoute.back")}</Link></Button></div>}
    </div></main>;
  }
  return resolved.mode === "v2"
    ? <SceneEditor key={`v2:${id}`} sceneId={id} mode="v2" initial={resolved.detail} organizationId={resolved.detail.organization_id} />
    : <SceneEditor key={`legacy:${id}`} sceneId={id} mode="legacy" organizationId={context.organizationId} />;
}
