import "server-only";
import { db } from "@/lib/db";
import { validateEmbedding } from "@/lib/anchor-matching";

/**
 * In-process cache of normalized anchor reference descriptors.
 *
 * Every recognition round compares the camera frame against the ready
 * references of all nearby anchors. Each descriptor has 8448 dimensions and
 * Postgres returns real[] as text, so loading 7 of them took ~70 ms per round
 * (measured 2026-10-08). The descriptors only change when an anchor's image is
 * re-processed, which always bumps `generation` and `updated_at`
 * (begin_anchor_embedding / syncAnchorEmbedding), so each round now reads just
 * that small metadata and fetches vectors only for anchors whose key changed.
 *
 * Scope: one app process (a single container today). A second instance would
 * have its own cache, which stays correct because validity is checked against
 * the database on every round.
 */

const MAX_ENTRIES = 256; // ~68 KB per descriptor → ~17 MB worst case

export interface ReferenceMeta {
  anchor_id: string;
  image_url: string;
  status: string;
  embedding_version: string | null;
  generation: string;
  updated_at: Date;
}

interface Entry {
  key: string;
  embedding: number[];
}

// Map iteration order doubles as LRU order (oldest first).
const cache = new Map<string, Entry>();

function keyOf(meta: Pick<ReferenceMeta, "generation" | "updated_at" | "embedding_version" | "image_url">): string {
  return `${meta.generation}|${new Date(meta.updated_at).getTime()}|${meta.embedding_version}|${meta.image_url}`;
}

function remember(anchorId: string, entry: Entry) {
  cache.delete(anchorId);
  cache.set(anchorId, entry);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Reference metadata (no vectors) for the given anchors. */
export async function readReferenceMeta(anchorIds: string[]): Promise<ReferenceMeta[]> {
  if (anchorIds.length === 0) return [];
  return db
    .selectFrom("anchor_embedding")
    .select(["anchor_id", "image_url", "status", "embedding_version", "generation", "updated_at"])
    .where("anchor_id", "in", anchorIds)
    .execute();
}

export interface LoadedReferences {
  /** anchor_id → normalized descriptor */
  vectors: Map<string, number[]>;
  hits: number;
  misses: number;
  /** true when a reference changed between the metadata read and the vector read */
  changed: boolean;
}

/**
 * Normalized descriptors for `ready` references (all must have status
 * "ready"). Cached vectors are reused while their key still matches.
 */
export async function loadReferenceVectors(ready: ReferenceMeta[]): Promise<LoadedReferences> {
  const vectors = new Map<string, number[]>();
  const missing: ReferenceMeta[] = [];
  for (const meta of ready) {
    const entry = cache.get(meta.anchor_id);
    if (entry && entry.key === keyOf(meta)) {
      remember(meta.anchor_id, entry); // refresh LRU position
      vectors.set(meta.anchor_id, entry.embedding);
    } else {
      missing.push(meta);
    }
  }
  const hits = vectors.size;
  if (missing.length === 0) return { vectors, hits, misses: 0, changed: false };

  const rows = await db
    .selectFrom("anchor_embedding")
    .select(["anchor_id", "image_url", "status", "embedding_version", "generation", "updated_at", "embedding"])
    .where(
      "anchor_id",
      "in",
      missing.map((m) => m.anchor_id),
    )
    .execute();
  const byId = new Map(rows.map((r) => [r.anchor_id, r]));
  let changed = false;
  for (const meta of missing) {
    const row = byId.get(meta.anchor_id);
    if (!row || row.status !== "ready" || keyOf(row) !== keyOf(meta)) {
      changed = true;
      continue;
    }
    const embedding = validateEmbedding(row.embedding);
    remember(meta.anchor_id, { key: keyOf(meta), embedding });
    vectors.set(meta.anchor_id, embedding);
  }
  return { vectors, hits, misses: missing.length, changed };
}
