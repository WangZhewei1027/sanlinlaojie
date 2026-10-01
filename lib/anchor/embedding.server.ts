import "server-only";
import { readReference } from "./reference.server";
export { referenceUrl } from "./reference.server";
import { createHash, randomUUID } from "node:crypto";
import { db, sql } from "@/lib/db";
import {
  MatchingError,
  MATCH_IMAGE_TYPES,
  MAX_MATCH_IMAGE_BYTES,
  validateEmbedding,
} from "@/lib/anchor-matching";

export function modelConfigured() {
  return !!process.env.SAGE_EAS_ENDPOINT && !!process.env.SAGE_EAS_TOKEN;
}
export async function embedImage(image: Blob) {
  if (!modelConfigured()) throw new MatchingError("匹配服务尚未配置", 503);
  if (
    !MATCH_IMAGE_TYPES.includes(image.type) ||
    !image.size ||
    image.size > MAX_MATCH_IMAGE_BYTES
  )
    throw new MatchingError("匹配图须为 JPEG、PNG 或 WebP，且不超过 4 MiB");
  const form = new FormData();
  form.set("image", image, "image");
  const response = await fetch(
    `${process.env.SAGE_EAS_ENDPOINT!.replace(/\/$/, "")}/embed`,
    {
      method: "POST",
      headers: { Authorization: process.env.SAGE_EAS_TOKEN! },
      body: form,
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
      redirect: "error",
    },
  );
  if (!response.ok)
    throw new MatchingError(
      response.status === 429 ? "匹配服务繁忙，请稍后重试" : "匹配服务暂不可用",
      response.status === 429 ? 429 : 502,
      response.status === 429 ? "model_busy" : undefined,
      response.status === 429 ? 2 : undefined,
    );
  const body = await response.json();
  if (
    body.model !== "sage_vitb" ||
    typeof body.embedding_version !== "string" ||
    !body.embedding_version ||
    body.embedding_version.length > 300
  )
    throw new MatchingError("模型返回版本无效", 502);
  return {
    embedding: validateEmbedding(body.embedding),
    version: body.embedding_version as string,
  };
}
/** Called by asset saves and the public feature-generation endpoint, never by recognition. */
export async function syncAnchorEmbedding(assetId: string, fileUrl: string) {
  if (!modelConfigured()) return "unconfigured";
  const generation = randomUUID();
  let started: boolean;
  try {
    const { rows } = await sql<{ started: boolean }>`
      select public.begin_anchor_embedding(${assetId}::uuid, ${fileUrl}, ${generation}::uuid) as started
    `.execute(db);
    started = rows[0]?.started === true;
  } catch {
    throw new MatchingError("匹配特征表不可用，请检查数据库迁移", 503);
  }
  if (!started) throw new MatchingError("匹配图片已变更，请刷新后重试", 409);
  try {
    const image = await readReference(fileUrl);
    const result = await embedImage(image);
    const checksum = createHash("sha256")
      .update(Buffer.from(await image.arrayBuffer()))
      .digest("hex");
    let saved: { anchor_id: string } | undefined;
    try {
      saved = await db
        .updateTable("anchor_embedding")
        .set({
          status: "ready",
          embedding: result.embedding,
          embedding_version: result.version,
          image_sha256: checksum,
          updated_at: new Date(),
        })
        .where("anchor_id", "=", assetId)
        .where("generation", "=", generation)
        .returning("anchor_id")
        .executeTakeFirst();
    } catch {
      throw new MatchingError("无法保存匹配特征", 503);
    }
    if (!saved)
      throw new MatchingError("匹配图片或生成任务已变更，请刷新后重试", 409);
    return "ready";
  } catch (error) {
    await db
      .updateTable("anchor_embedding")
      .set({ status: "failed" })
      .where("anchor_id", "=", assetId)
      .where("generation", "=", generation)
      .execute()
      .catch(() => undefined);
    throw error;
  }
}
export async function trySyncAnchor(asset: {
  id: string;
  file_type: string;
  file_url: string | null;
}) {
  if (asset.file_type !== "anchor" || !asset.file_url) return;
  try {
    await syncAnchorEmbedding(asset.id, asset.file_url);
  } catch {
    /* Asset remains saved; management status exposes a retry action. */
  }
}
