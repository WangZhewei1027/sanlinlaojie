"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { FileDropzone } from "@/app/manage/components/upload/file-dropzone";
import { acceptFor, LIBRARY_UPLOAD_TYPES, type LibraryUploadType } from "@/app/manage/lib/content-upload";
import type { IntegrationT } from "@/app/manage/lib/integration-text";
import type { AssetInputContent } from "./asset-upload";

export type CreatableType = LibraryUploadType | "text" | "link";
export const CREATABLE_TYPES: readonly CreatableType[] = [...LIBRARY_UPLOAD_TYPES, "text", "link"];

export interface DraftContent {
  file: File | null;
  /** Text body or link input, depending on the type. */
  text: string;
}

export function isFileType(type: CreatableType): type is LibraryUploadType {
  return (LIBRARY_UPLOAD_TYPES as readonly string[]).includes(type);
}

/** The submit-ready content, or null while the draft is incomplete. */
export function contentOf(type: CreatableType, draft: DraftContent): AssetInputContent | null {
  if (isFileType(type)) return draft.file ? { kind: "file", type, file: draft.file } : null;
  if (!draft.text.trim()) return null;
  return type === "text" ? { kind: "text", text: draft.text } : { kind: "link", url: draft.text.trim() };
}

/** Suggested asset name: file name without extension, first words of a text, or the link host. */
export function defaultNameFor(type: CreatableType, draft: DraftContent): string {
  if (isFileType(type)) return draft.file ? draft.file.name.replace(/\.[^.]+$/, "") : "";
  const value = draft.text.trim();
  if (type === "text") return value.split("\n")[0].slice(0, 24);
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

export function AssetContentField({ type, draft, onChange, disabled, tx }: {
  type: CreatableType;
  draft: DraftContent;
  onChange: (draft: DraftContent) => void;
  disabled?: boolean;
  tx: IntegrationT;
}) {
  const id = useId();
  if (isFileType(type)) {
    return (
      <FileDropzone
        file={draft.file}
        onFileSelect={(file) => onChange({ ...draft, file })}
        onFileRemove={() => onChange({ ...draft, file: null })}
        accept={acceptFor(type) || undefined}
        disabled={disabled}
        label={tx("contentModel.integration.assets.create.file")}
      />
    );
  }
  if (type === "text") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{tx("contentModel.integration.assets.create.text")}</Label>
        <Textarea id={id} value={draft.text} onChange={(event) => onChange({ ...draft, text: event.target.value })} disabled={disabled} rows={5} />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{tx("contentModel.integration.assets.create.url")}</Label>
      <Input id={id} value={draft.text} onChange={(event) => onChange({ ...draft, text: event.target.value })} disabled={disabled} placeholder="https://" inputMode="url" />
      <Text as="p" variant="bodyXs" tone="subdued">{tx("contentModel.integration.assets.create.urlHint")}</Text>
    </div>
  );
}
