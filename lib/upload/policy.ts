import type { UploadType } from "./types";

/** Original-file limits, shared by the picker and upload endpoint. */
export const UPLOAD_SOURCE_MAX_MB: Readonly<Record<UploadType, number>> = {
  image: 32,
  audio: 32,
  anchor: 32,
  video: 3,
  model: 3,
  document: 5,
  scene: 0.25,
  text: 5,
  link: 5,
};

/** Limits apply separately: processing can accept a larger original. */
export const STORED_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_MULTIPART_BYTES = 33 * 1024 * 1024;

export function getUploadSourceLimitBytes(type: UploadType): number {
  return UPLOAD_SOURCE_MAX_MB[type] * 1024 * 1024;
}
