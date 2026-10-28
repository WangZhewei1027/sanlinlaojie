import { ALL_UPLOAD_TYPES, type UploadType } from "./types";

/** Shared picker hints; actual media bytes are validated by the server. */
export const UPLOAD_ACCEPTS: Readonly<Record<UploadType, string>> = {
  image: "image/*",
  audio: "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.aiff,.aif,.amr,.wma",
  video: "video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,video/3gpp,.mp4,.mov,.webm,.avi,.mkv,.3gp",
  document: ".pdf,.doc,.docx,.txt,.md",
  anchor: "image/jpeg,image/png,image/webp",
  model: ".gltf,.glb",
  scene: ".json",
  text: "",
  link: "",
};

const EXTENSION_TYPE_MAP: Record<string, UploadType> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  bmp: "image", heic: "image", heif: "image", avif: "image", tif: "image", tiff: "image", svg: "image",
};
for (const type of ALL_UPLOAD_TYPES) {
  for (const token of UPLOAD_ACCEPTS[type].split(",")) {
    if (token.startsWith(".")) EXTENSION_TYPE_MAP[token.slice(1)] = type;
  }
}

/** MIME first, then extension for files reported as application/octet-stream. */
export function inferUploadType(mimeType: string, fileName?: string): UploadType {
  const mime = mimeType.split(";")[0].trim().toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "model/gltf+json" || mime === "model/gltf-binary") return "model";
  if (mime.includes("pdf") || mime.includes("document") || mime.startsWith("text/")) return "document";
  const extension = fileName?.split(".").pop()?.toLowerCase();
  return (extension && EXTENSION_TYPE_MAP[extension]) || "document";
}
