import { UUID } from "./shared";

export interface ArchiveReviewEntry {
  assetId: string;
  sourceHash: string;
  reason: string;
}

/** Explicit, fingerprint-bound decisions for ownerless legacy rows only. */
export function parseArchiveReview(value: unknown): ArchiveReviewEntry[] {
  if (!value || typeof value !== "object" || !("format" in value) ||
    value.format !== "content-model-orphan-review-v1" || !("assets" in value) || !Array.isArray(value.assets)) {
    throw new Error("Archive review must use format content-model-orphan-review-v1 and an assets array");
  }
  const ids = new Set<string>();
  return value.assets.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid archive review entry");
    const { assetId, sourceHash, reason } = entry as Record<string, unknown>;
    if (typeof assetId !== "string" || !UUID.test(assetId) || ids.has(assetId) ||
      typeof sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(sourceHash) ||
      typeof reason !== "string" || !reason.trim()) throw new Error("Invalid or duplicate archive review entry");
    ids.add(assetId);
    return { assetId, sourceHash, reason: reason.trim() };
  });
}
