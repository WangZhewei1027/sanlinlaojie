"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileDropzone } from "../components/upload/file-dropzone";
import { ContentFailureNotice } from "./ContentFeedback";
import { useContentAction } from "./useContentAction";
import type { ContentAction, ContentAssetType } from "./types";

export interface AssetContentInput {
  file?: File;
  text?: string;
  url?: string;
}

export interface AssetEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetName: string;
  assetType: ContentAssetType;
  initialText?: string;
  /** Accept rule from the upload config for this type, e.g. ".glb,.gltf". */
  accept?: string;
  /** Upload progress 0–100 while the receipt is being created, when known. */
  progress?: number | null;
  /** A stale lock returns a conflict; the dialog keeps the chosen file for retry. */
  onSubmit: ContentAction<[input: AssetContentInput]>;
}

export function AssetEditDialog(props: AssetEditDialogProps) {
  const { t } = useTranslation();
  const contentId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState(props.initialText ?? "");
  const action = useContentAction();
  const kind = props.assetType === "text" ? "text" : props.assetType === "link" ? "url" : "file";
  const ready = kind === "file" ? !!file : text.trim().length > 0;

  const close = (next: boolean) => {
    if (action.pending) return;
    if (!next) { setFile(null); setText(props.initialText ?? ""); action.reset(); }
    props.onOpenChange(next);
  };
  const submit = async () => {
    const input: AssetContentInput = {};
    if (kind === "file" && file) input.file = file;
    if (kind === "text") input.text = text;
    if (kind === "url") input.url = text.trim();
    if (await action.run(() => props.onSubmit(input))) close(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contentModel.edit.title")}</DialogTitle>
          <DialogDescription>{t("contentModel.edit.body", { name: props.assetName })}</DialogDescription>
        </DialogHeader>

        {kind === "file" ? (
          <div role="group" aria-label={t("contentModel.edit.file")}>
            <FileDropzone file={file} onFileSelect={setFile} onFileRemove={() => setFile(null)} accept={props.accept} disabled={action.pending} label={t("contentModel.edit.file")} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={contentId}>{kind === "text" ? t("contentModel.edit.text") : t("contentModel.edit.url")}</Label>
            {kind === "text" ? (
              <Textarea id={contentId} value={text} onChange={(event) => setText(event.target.value)} disabled={action.pending} rows={5} />
            ) : (
              <Input id={contentId} type="url" inputMode="url" value={text} onChange={(event) => setText(event.target.value)} disabled={action.pending} placeholder="https://" />
            )}
          </div>
        )}


        {action.pending && props.progress != null && (
          <div className="space-y-1" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(props.progress)} aria-label={t("contentModel.edit.uploading")}>
              <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${Math.min(100, Math.max(0, props.progress))}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{t("contentModel.edit.uploadingPercent", { percent: Math.round(props.progress) })}</span>
          </div>
        )}
        {action.failure && <ContentFailureNotice failure={action.failure} />}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={action.pending}>{t("contentModel.action.cancel")}</Button>
          <Button onClick={submit} disabled={!ready || action.pending}>
            {action.pending && <Loader2 className="animate-spin" aria-hidden />}
            {action.pending ? t("contentModel.edit.uploading") : t("contentModel.edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
