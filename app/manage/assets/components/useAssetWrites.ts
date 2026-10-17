"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AssetDetailDto } from "@/lib/content-model/contracts";
import type { AssetVersionInput, ContentActionResult } from "@/app/manage/content";
import { assetApi, isLockConflict } from "@/app/manage/lib/content-api";
import { impactLines, runContentAction } from "@/app/manage/lib/content-errors";
import type { IntegrationT } from "@/app/manage/lib/integration-text";
import { bodyForIntent, contentSignature, intentFor, settleFailure, withNote, type UploadIntent, type VersionContent } from "./asset-upload";
import { isFileType, type CreatableType } from "./AssetContentField";
import type { useAssetDetail } from "./useAssetDetail";

type Detail = ReturnType<typeof useAssetDetail>;

function versionContent(asset: AssetDetailDto, input: AssetVersionInput): VersionContent | null {
  const type = asset.file_type as CreatableType;
  if (input.file) return isFileType(type) ? { kind: "file", type, file: input.file } : null;
  if (asset.file_type === "text" && input.text !== undefined) return { kind: "text", text: input.text };
  if (asset.file_type === "link" && input.url !== undefined) return { kind: "link", url: input.url };
  return null;
}

/**
 * Every write sends the latest lock, applies the returned identity row and
 * reloads detail + usage. A stale lock marks the page stale instead of retrying.
 */
export function useAssetWrites(detail: Detail, tx: IntegrationT) {
  const { t } = useTranslation();
  const [stale, setStale] = useState(false);
  const [archiveImpact, setArchiveImpact] = useState<string[] | null>(null);
  const versionIntent = useRef<UploadIntent | null>(null);
  const asset = detail.asset;

  const write = <T,>(action: (lock: number) => Promise<T>, after?: (value: T) => void): Promise<ContentActionResult> =>
    runContentAction(
      async () => {
        try {
          return await action(detail.lockVersion());
        } catch (error) {
          if (isLockConflict(error)) setStale(true);
          throw error;
        }
      },
      tx,
      async (value) => {
        after?.(value);
        await detail.refresh();
      },
    );
  const failed = (message?: string): ContentActionResult => ({ ok: false, kind: "error", message });

  const uploadVersion = async (input: AssetVersionInput): Promise<ContentActionResult> => {
    if (!asset) return failed();
    const content = versionContent(asset, input);
    if (!content) return failed();
    // New versions upload into the asset's team; no collection is involved.
    const current = intentFor(versionIntent, [asset.organization_id, input.note, contentSignature(content)].join("|"));
    return write(
      async (lock) => {
        try {
          const body = await bodyForIntent(current, content, asset.organization_id, (key) => String(t(key)));
          return await assetApi.createVersion(asset.id, {
            payload: withNote(body.payload, input.note),
            resources: body.resources,
            idempotencyKey: current.key,
            expectedLockVersion: lock,
          });
        } catch (error) {
          settleFailure(versionIntent, error);
          throw error;
        }
      },
      (result) => {
        versionIntent.current = null;
        detail.applyAsset(result.asset);
      },
    );
  };

  const onAsset = (run: (assetId: string) => Promise<ContentActionResult>) => (asset ? run(asset.id) : Promise.resolve(failed()));
  const update = (fields: { name?: string; state?: "active" }) =>
    onAsset((assetId) => write((lock) => assetApi.update(assetId, { expectedLockVersion: lock, ...fields }), detail.applyAsset));

  return {
    stale,
    archiveImpact,
    dismissArchiveImpact: () => setArchiveImpact(null),
    reload: async () => {
      setStale(false);
      await detail.refresh();
    },
    uploadVersion,
    rename: (name: string) => update({ name }),
    restore: async () => {
      const result = await update({ state: "active" });
      if (result.ok) setArchiveImpact(null);
      return result;
    },
    archive: () =>
      onAsset((assetId) =>
        write((lock) => assetApi.archive(assetId, lock), (result) => {
          detail.applyAsset(result.asset);
          setArchiveImpact(impactLines(result.impact, tx));
        }),
      ),
  };
}
