"use client";

import { useRef } from "react";
import type { CreateAssetResult } from "@/lib/content-model/contracts";
import { assetApi } from "@/app/manage/lib/content-api";
import { runContentAction } from "@/app/manage/lib/content-errors";
import type { IntegrationT } from "@/app/manage/lib/integration-text";
import { intentFor, settleFailure, type UploadIntent } from "./asset-upload";
import { AssetNameDialog } from "./AssetNameDialog";

export interface AssetDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  assetName: string;
  onDuplicated: (result: CreateAssetResult) => void;
  tx: IntegrationT;
}

/** "另存素材副本": a new team asset with independent content; the original is untouched. */
export function AssetDuplicateDialog(props: AssetDuplicateDialogProps) {
  const { tx } = props;
  const intent = useRef<UploadIntent | null>(null);

  const submit = (name: string) => {
    const current = intentFor(intent, name);
    return runContentAction(
      async () => {
        try {
          // Same-team copy: no target workspace.
          return await assetApi.duplicate(props.assetId, { name, idempotencyKey: current.key });
        } catch (error) {
          settleFailure(intent, error);
          throw error;
        }
      },
      tx,
      (result) => {
        intent.current = null;
        props.onDuplicated(result);
      },
    );
  };

  return (
    <AssetNameDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={tx("contentModel.integration.assetDetail.duplicate")}
      description={tx("contentModel.integration.assetDetail.duplicateBody")}
      nameLabel={tx("contentModel.integration.assetDetail.name")}
      submitLabel={tx("contentModel.integration.assetDetail.duplicateAction")}
      cancelLabel={tx("contentModel.integration.assetDetail.cancel")}
      initialName={tx("contentModel.integration.assetDetail.duplicateName", { name: props.assetName })}
      onSubmit={submit}
    />
  );
}
