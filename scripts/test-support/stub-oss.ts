/** Test double for lib/storage/oss.ts (route tests only; installed by install-route-stubs.ts). In-memory, no network. */
import { mediaUrl } from "../../lib/storage/public-url";

export { mediaUrl, mediaKeyFromUrl, assetKeyFromUrl, ASSETS_PREFIX, WECHAT_QR_PREFIX } from "../../lib/storage/public-url";

export interface PutObjectOptions {
  contentType: string;
  cacheControl?: string;
}

export interface ObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

const objects = new Map<string, ObjectInfo>();

/** Objects written by the code under test, for assertions. */
export const stubObjects: ReadonlyMap<string, ObjectInfo> = objects;

export function seedStubObject(key: string, size = 1): void {
  objects.set(key, { key, size, lastModified: new Date(), contentType: "application/octet-stream" });
}

export async function putObject(key: string, body: Buffer | Uint8Array, options: PutObjectOptions): Promise<string> {
  objects.set(key, { key, size: body.length, lastModified: new Date(), contentType: options.contentType });
  return mediaUrl(key);
}

export async function deleteObjects(keys: string[]): Promise<void> {
  throw new Error(`Physical deletion is forbidden in route tests (${keys.length} keys)`);
}

export async function headObject(key: string): Promise<ObjectInfo | null> {
  return objects.get(key) ?? null;
}

export async function* listObjects(prefix: string): AsyncGenerator<ObjectInfo> {
  for (const info of objects.values()) if (info.key.startsWith(prefix)) yield info;
}

export async function getObject(key: string): Promise<Buffer> {
  if (!objects.has(key)) throw new Error(`No stub object ${key}`);
  return Buffer.alloc(objects.get(key)!.size);
}
