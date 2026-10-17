/**
 * Turns a user's file / text / link into a v2 version body, and keeps one
 * idempotency key (plus the already-uploaded receipt) per submission intent so
 * a retry after a network failure replays the same command instead of
 * creating a second asset or version.
 */
import type { MutableRefObject } from "react";
import type { AssetVersionPayload, ResourceInput } from "@/lib/content-model/contracts";
import { getLinkAssetErrorKey, parseLinkAssetInput } from "@/lib/link-asset";
import { isContentApiError, newIdempotencyKey } from "@/app/manage/lib/content-api";
import { linkPayload, prepareFile, textPayload, uploadFileVersion, type LibraryUploadType } from "@/app/manage/lib/content-upload";

export type VersionContent =
  | { kind: "file"; type: LibraryUploadType; file: File }
  | { kind: "text"; text: string }
  | { kind: "link"; url: string };

export type UploadStage = "preparing" | "uploading" | "creating";

export interface VersionBody {
  payload: AssetVersionPayload;
  resources: ResourceInput[];
}

export interface UploadIntent {
  signature: string;
  key: string;
  /** Set once the receipt exists, so a retry does not upload the file again. */
  body?: VersionBody;
}

export function contentSignature(content: VersionContent): string {
  if (content.kind === "file") return `file:${content.type}:${content.file.name}:${content.file.size}:${content.file.lastModified}`;
  if (content.kind === "text") return `text:${content.text}`;
  return `link:${content.url.trim()}`;
}

/** Same signature → same key and cached body; anything changed → a fresh intent. */
export function intentFor(ref: MutableRefObject<UploadIntent | null>, signature: string): UploadIntent {
  if (!ref.current || ref.current.signature !== signature) ref.current = { signature, key: newIdempotencyKey() };
  return ref.current;
}

/**
 * A definitive 4xx means nothing was created: rotate the key (the next body may
 * carry a new lock version). A rejected receipt also drops the cached upload.
 * Network and 5xx failures keep the key, since the first attempt may have landed.
 */
export function settleFailure(ref: MutableRefObject<UploadIntent | null>, error: unknown) {
  const intent = ref.current;
  if (!intent || !isContentApiError(error)) return;
  if (error.code === "RECEIPT_INVALID") { ref.current = null; return; }
  if (error.status >= 400 && error.status < 500) intent.key = newIdempotencyKey();
}

/** Parse a link or throw an Error carrying the localized reason. */
export function parseLink(url: string, translate: (key: string) => string) {
  try {
    return parseLinkAssetInput(url);
  } catch (error) {
    throw new Error(translate(getLinkAssetErrorKey(error)));
  }
}

export async function buildVersionBody(
  content: VersionContent,
  workspaceId: string,
  translate: (key: string) => string,
  onStage?: (stage: UploadStage) => void,
): Promise<VersionBody> {
  if (content.kind === "text") return { payload: textPayload(content.text), resources: [] };
  if (content.kind === "link") return { payload: linkPayload(parseLink(content.url, translate)), resources: [] };
  onStage?.("preparing");
  const prepared = await prepareFile(content.file, content.type);
  onStage?.("uploading");
  const { payload, resources } = await uploadFileVersion(prepared, workspaceId);
  return { payload, resources };
}

/** Reuse the cached body of this intent or build (and cache) a new one. */
export async function bodyForIntent(
  intent: UploadIntent,
  content: VersionContent,
  workspaceId: string,
  translate: (key: string) => string,
  onStage?: (stage: UploadStage) => void,
): Promise<VersionBody> {
  if (!intent.body) intent.body = await buildVersionBody(content, workspaceId, translate, onStage);
  return intent.body;
}

export function withNote(payload: AssetVersionPayload, note: string): AssetVersionPayload {
  const trimmed = note.trim();
  return trimmed ? { ...payload, attributes: { ...payload.attributes, note: trimmed } } : payload;
}
