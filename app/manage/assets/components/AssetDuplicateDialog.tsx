"use client";

import { useId, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import type { CreateAssetResult } from "@/lib/content-model/contracts";
import type { ContentProject } from "@/app/manage/content";
import { assetApi } from "@/app/manage/lib/content-api";
import { useWorkspaceInfo } from "@/app/manage/lib/content-context";
import { runContentAction } from "@/app/manage/lib/content-errors";
import type { IntegrationT } from "@/app/manage/lib/integration-text";
import { intentFor, settleFailure, type UploadIntent } from "./asset-upload";
import { AssetNameDialog } from "./AssetNameDialog";

export interface AssetDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  assetName: string;
  /** Same-organization projects; edit rights are checked per selection. */
  projects: ContentProject[];
  defaultProjectId: string | null;
  onDuplicated: (result: CreateAssetResult, workspaceId: string) => void;
  tx: IntegrationT;
}

/** "另存素材副本": a new asset with its own version history in a writable project. */
export function AssetDuplicateDialog(props: AssetDuplicateDialogProps) {
  const { tx } = props;
  const id = useId();
  const fallback = props.defaultProjectId && props.projects.some((project) => project.id === props.defaultProjectId)
    ? props.defaultProjectId
    : props.projects[0]?.id ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const target = picked ?? fallback;
  const info = useWorkspaceInfo(props.open ? target : null);
  const intent = useRef<UploadIntent | null>(null);
  const writable = info.status === "ready" && !!info.workspace?.capabilities.can_edit && !info.workspace.archived_at;

  const hint = !target
    ? tx("contentModel.integration.assetDetail.noProjects")
    : info.status === "loading"
      ? tx("contentModel.integration.assetDetail.targetChecking")
      : info.workspace?.archived_at
        ? tx("contentModel.integration.assetDetail.targetArchived")
        : !writable
          ? tx("contentModel.integration.assetDetail.targetNoEdit")
          : null;

  const submit = (name: string) => {
    if (!target) return Promise.resolve();
    const current = intentFor(intent, `${target}|${name}`);
    return runContentAction(
      async () => {
        try {
          return await assetApi.duplicate(props.assetId, { targetWorkspaceId: target, name, idempotencyKey: current.key });
        } catch (error) {
          settleFailure(intent, error);
          throw error;
        }
      },
      tx,
      (result) => {
        intent.current = null;
        props.onDuplicated(result, target);
      },
    );
  };

  return (
    <AssetNameDialog
      open={props.open}
      onOpenChange={(next) => { if (!next) setPicked(null); props.onOpenChange(next); }}
      title={tx("contentModel.integration.assetDetail.duplicate")}
      description={tx("contentModel.integration.assetDetail.duplicateBody")}
      nameLabel={tx("contentModel.integration.assetDetail.name")}
      submitLabel={tx("contentModel.integration.assetDetail.duplicateAction")}
      cancelLabel={tx("contentModel.integration.assetDetail.cancel")}
      initialName={tx("contentModel.integration.assetDetail.duplicateName", { name: props.assetName })}
      canSubmit={!!target && writable}
      onSubmit={submit}
    >
      <div className="space-y-1.5">
        <Label htmlFor={id}>{tx("contentModel.integration.assetDetail.targetProject")}</Label>
        <Select value={target ?? undefined} onValueChange={setPicked} disabled={!props.projects.length}>
          <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {props.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {hint && <Text as="p" variant="bodyXs" tone={info.status === "loading" ? "subdued" : "warning"}>{hint}</Text>}
      </div>
    </AssetNameDialog>
  );
}
