import { MEDIA_BASE_URL, mediaUrl } from "@/lib/storage/public-url";

/** Public URL of a managed object key; falls back to the key when no media host is configured (dev). */
export function publicObjectUrl(key: string): string {
  return MEDIA_BASE_URL ? mediaUrl(key) : key;
}

export function resourceUrl(row: { storage_key: string | null; external_url: string | null }): string {
  return row.storage_key ? publicObjectUrl(row.storage_key) : row.external_url ?? "";
}
