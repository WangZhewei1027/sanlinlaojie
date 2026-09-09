"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useManageStore } from "../../store";
import type { Asset } from "../../types";
import { MatchingPointPanel } from "./MatchingPointPanel";
import { useMatchingStatus } from "./hooks/useMatchingStatus";

interface Props {
  asset: Asset;
  workspaceId: string | null;
  isEditing: boolean;
  isSaving: boolean;
  readOnly: boolean;
  imageFile: File | null;
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
  onUpdateAsset?: (id: string, updates: Partial<Asset>) => Promise<Asset>;
}
export function MatchingPointSection(props: Props) {
  const { t } = useTranslation();
  const assets = useManageStore((s) => s.assets);
  const matching = useMatchingStatus(props.asset.id, props.asset.file_url, props.isSaving);
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
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
      status={props.isSaving && props.imageFile ? "saving" : matching.status}
      updatedAt={matching.updatedAt}
      statusError={matching.error}
      onRefresh={matching.refresh}
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
      onRebuild={matching.rebuild}
      onAttach={(id) => attach(id, props.asset.id)}
      onDetach={(id) => attach(id, null)}
    />
  );
}
