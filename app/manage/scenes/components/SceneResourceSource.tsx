"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Text } from "@/components/ui/typography";
import { AssetVersionUpgrade, type UpgradeScope } from "@/app/manage/content/AssetVersionUpgrade";
import type { ContentActionResult } from "@/app/manage/content/types";
import type { InstanceAnimation } from "@/lib/scene/protocol";
import { assetApi } from "../../lib/content-api";
import { ERROR_TEXTS, errorMessage } from "../../lib/content-errors";
import { primaryResource } from "../../lib/content-mappers";
import { missingClip } from "../../lib/scene-v3";
import { useIntegrationText, type IntegrationTexts } from "../../lib/integration-text";
import type { SceneResource } from "./types";

const TEXTS: IntegrationTexts = {
  ...ERROR_TEXTS,
  "contentModel.integration.sceneSource.title": ["来源素材", "Source asset"],
  "contentModel.integration.sceneSource.pinned": ["固定版本 v{{version}}", "Pinned to v{{version}}"],
  "contentModel.integration.sceneSource.open": ["打开素材详情", "Open asset details"],
  "contentModel.integration.sceneSource.archived": ["素材已归档：现有引用可继续保存和发布，但不能新增引用。", "Asset archived: existing references still save and publish; no new references."],
  "contentModel.integration.sceneSource.latestFailed": ["无法读取最新版本：{{message}}", "Could not read the latest version: {{message}}"],
};

/**
 * Inspector block for the selected object's source: pinned version, link to
 * the asset, and the explicit upgrade (preview first, clip check, scope).
 */
export function SceneResourceSource({ instanceId, animation, resource, latest, aliasInstanceCount, aliasAnimations, assetHref, readOnly, previewing, onRegister, onPreview, onUpgrade }: {
  instanceId: string;
  animation: InstanceAnimation | null;
  resource: SceneResource;
  latest: SceneResource | undefined;
  aliasInstanceCount: number;
  /** Animations of every instance sharing the alias, for the "all instances" scope check. */
  aliasAnimations: (InstanceAnimation | null)[];
  assetHref: string;
  readOnly: boolean;
  previewing: boolean;
  onRegister: (resource: SceneResource) => void;
  onPreview: (url: string | null) => void;
  onUpgrade: (scope: UpgradeScope, latest: SceneResource) => ContentActionResult;
}) {
  const tx = useIntegrationText(TEXTS);
  const [failure, setFailure] = useState("");
  const latestId = resource.upgradeAvailable ? resource.currentVersionId : null;

  useEffect(() => {
    if (!latestId || latest) return;
    const abort = new AbortController();
    setFailure("");
    assetApi.get(resource.assetId, abort.signal).then((asset) => {
      const version = asset.versions.find((item) => item.id === latestId);
      if (!version) return;
      onRegister({
        assetId: asset.id, assetVersionId: version.id, name: asset.name, url: primaryResource(version)?.url ?? null, versionNo: version.version_no,
        currentVersionId: asset.current_version_id, currentVersionNo: asset.current_version_no, upgradeAvailable: false, assetState: asset.state,
        animations: version.payload.kind === "model" ? version.payload.animations : undefined,
      });
    }).catch((error) => { if (!abort.signal.aborted) setFailure(errorMessage(error, tx)); });
    return () => abort.abort();
  }, [latestId, latest, resource.assetId, onRegister, tx]);

  const missing = latest ? missingClip(animation, latest.animations) : null;
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <Text as="h3" variant="bodyXs" fontWeight="semibold">{tx("contentModel.integration.sceneSource.title")}</Text>
      <Link href={assetHref} target="_blank" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline" aria-label={tx("contentModel.integration.sceneSource.open")}>
        <Text as="span" variant="bodyXs" truncate className="max-w-36">{resource.name || resource.assetId.slice(0, 8)}</Text><ExternalLink className="size-3 shrink-0" aria-hidden />
      </Link>
    </div>
    {!resource.upgradeAvailable || readOnly || !resource.versionNo || !resource.currentVersionNo
      ? <Text as="p" variant="bodyXs" tone="subdued" className="tabular-nums">{tx("contentModel.integration.sceneSource.pinned", { version: resource.versionNo ?? "?" })}</Text>
      : <AssetVersionUpgrade
          referenceId={instanceId}
          assetName={resource.name || resource.assetId.slice(0, 8)}
          pinnedVersionNo={resource.versionNo}
          latestVersionNo={resource.currentVersionNo}
          assetState={resource.assetState}
          aliasInstanceCount={aliasInstanceCount}
          missingClipName={missing}
          previewing={previewing}
          onPreview={latest?.url ? () => onPreview(previewing ? null : latest.url) : undefined}
          onUpgrade={async (scope) => {
            if (!latest) return { ok: false, kind: "error", message: failure || undefined };
            const blocking = (scope === "alias" ? aliasAnimations : [animation]).map((item) => missingClip(item, latest.animations)).find(Boolean);
            if (blocking) return { ok: false, kind: "conflict", message: blocking };
            return onUpgrade(scope, latest);
          }}
        />}
    {resource.assetState === "archived" && <Text as="p" variant="bodyXs" tone="warning">{tx("contentModel.integration.sceneSource.archived")}</Text>}
    {failure && <Text as="p" variant="bodyXs" tone="critical">{tx("contentModel.integration.sceneSource.latestFailed", { message: failure })}</Text>}
  </div>;
}
