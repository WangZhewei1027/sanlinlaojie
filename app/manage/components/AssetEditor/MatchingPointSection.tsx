"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useManageStore } from "../../store";
import type { Asset } from "../../types";
import { MatchingPointPanel, type MatchingStatus } from "./MatchingPointPanel";

interface Props {
  asset: Asset;
  workspaceId: string | null;
  isEditing: boolean;
  readOnly: boolean;
  imageFile: File | null;
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
  onUpdateAsset?: (id: string, updates: Partial<Asset>) => Promise<Asset>;
}
export function MatchingPointSection(props: Props) {
  const { t } = useTranslation();
  const assets = useManageStore((s) => s.assets);
  const [status, setStatus] = useState<MatchingStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    fetch(`/api/assets/${props.asset.id}/matching`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        return body;
      })
      .then((body) => setStatus(body.data.status))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setStatus("failed");
          setError(error.message || t("matching.loadFailed"));
        }
      });
    return () => controller.abort();
  }, [props.asset.id, props.asset.file_url, revision, t]);
  async function rebuild() {
    setStatus("processing");
    setError(null);
    try {
      const response = await fetch(`/api/assets/${props.asset.id}/matching`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRevision((v) => v + 1);
    } catch (error) {
      setStatus("failed");
      setError(
        error instanceof Error ? error.message : t("matching.loadFailed"),
      );
    }
  }
  async function attach(id: string, parentId: string | null) {
    if (!props.onUpdateAsset) return;
    setAttaching(true);
    setError(null);
    try {
      await props.onUpdateAsset(id, { anchor_id: parentId });
    } catch {
      setError(t("matching.childrenFailed"));
    } finally {
      setAttaching(false);
    }
  }
  const inWorkspace = assets.filter(
    (a) =>
      a.file_type !== "anchor" &&
      props.workspaceId &&
      a.workspace_id?.includes(props.workspaceId),
  );
  const label = (a: Asset) => ({
    id: a.id,
    name: a.name || a.text_content || t(`fileTypes.${a.file_type}`),
  });
  return (
    <MatchingPointPanel
      imageUrl={props.asset.file_url}
      imageFile={props.imageFile}
      isEditing={props.isEditing}
      status={status}
      error={error}
      canManage={
        !props.readOnly && !!props.workspaceId && !!props.onUpdateAsset
      }
      childrenAssets={assets
        .filter((a) => a.anchor_id === props.asset.id)
        .map(label)}
      availableAssets={inWorkspace.filter((a) => !a.anchor_id).map(label)}
      attaching={attaching}
      onImageSelect={props.onImageSelect}
      onImageRemove={props.onImageRemove}
      onRebuild={rebuild}
      onAttach={(id) => attach(id, props.asset.id)}
      onDetach={(id) => attach(id, null)}
    />
  );
}
