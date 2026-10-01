import "server-only";
import { db, sql } from "@/lib/db";
import {
  chooseMatch,
  cosine,
  finiteNumber,
  MatchingError,
  parseGps,
  validateEmbedding,
} from "@/lib/anchor-matching";
import { embedImage } from "./embedding.server";

interface Candidate {
  id: string;
  name: string;
  file_url: string;
  metadata: Record<string, unknown>;
  distance_meters: number;
}

async function findNearbyAnchors(
  workspaceId: string,
  gps: { latitude: number; longitude: number; radius: number },
): Promise<Candidate[]> {
  const { rows } = await sql<Candidate>`
    select id, name, file_url, metadata, distance_meters
    from public.find_nearby_matching_anchors(
      ${workspaceId}::uuid, ${gps.latitude}, ${gps.longitude}, ${gps.radius}
    )
  `.execute(db);
  return rows;
}

export async function recognizeAnchor(
  workspaceId: string,
  form: FormData,
  image: Blob,
) {
  const startedAt = performance.now();
  let checkpoint = startedAt;
  const timings: Record<string, number> = {};
  const mark = (stage: string) => {
    const now = performance.now();
    timings[stage] = Math.round(now - checkpoint);
    checkpoint = now;
  };
  const gps = parseGps(form);
  // Explicit calibration is required: no invented universal similarity cutoff.
  if (!process.env.SAGE_MATCH_THRESHOLD)
    throw new MatchingError("请先配置视觉匹配阈值", 503);
  const threshold = finiteNumber(
    process.env.SAGE_MATCH_THRESHOLD,
    -1,
    1,
    "SAGE_MATCH_THRESHOLD",
  );
  const margin = finiteNumber(
    process.env.SAGE_MATCH_MARGIN ?? "0.03",
    0,
    2,
    "SAGE_MATCH_MARGIN",
  );
  // Summary only: no candidate identities, URLs, GPS coordinates or vectors.
  const diagnostics = {
    candidate_count: 0,
    ready_reference_count: 0,
    threshold,
    required_margin: margin,
    best_similarity: null as number | null,
    second_similarity: null as number | null,
    score_gap: null as number | null,
    best_distance_meters: null as number | null,
  };
  const snapshot = (): typeof diagnostics & { timings_ms: Record<string, number> } => ({
    ...diagnostics,
    timings_ms: { ...timings, matching_total_ms: Math.round(performance.now() - startedAt) },
  });
  mark("validation_ms");
  let allowed: boolean;
  try {
    const { rows } = await sql<{ allowed: boolean }>`
      select public.consume_anchor_match_request(${workspaceId}::uuid) as allowed
    `.execute(db);
    allowed = rows[0]?.allowed === true;
  } catch {
    throw new MatchingError("匹配接口未就绪，请检查数据库迁移", 503);
  }
  mark("rate_limit_ms");
  if (!allowed)
    throw new MatchingError(
      "工作空间请求过于频繁，请稍后重试",
      429,
      "workspace_rate_limited",
      60,
    );
  let candidates: Candidate[];
  try {
    candidates = await findNearbyAnchors(workspaceId, gps);
  } catch {
    throw new MatchingError("无法查询附近匹配点", 503);
  }
  mark("gps_query_ms");
  diagnostics.candidate_count = candidates.length;
  const empty = (reason: string) => ({
    matched: false,
    reason,
    anchor: null,
    assets: [],
    gps_radius_meters: gps.radius,
    diagnostics: snapshot(),
  });
  if (!candidates.length) return empty("no_nearby_anchor");
  if (candidates.length > 200)
    throw new MatchingError("附近匹配点过多，请缩小工作空间", 422);
  let rows;
  try {
    rows = await db
      .selectFrom("anchor_embedding")
      .select(["anchor_id", "image_url", "embedding", "embedding_version", "status"])
      .where(
        "anchor_id",
        "in",
        candidates.map((c) => c.id),
      )
      .execute();
  } catch {
    throw new MatchingError("无法读取匹配特征", 503);
  }
  mark("reference_read_ms");
  const ready = rows.filter(
    (r) =>
      r.status === "ready" &&
      candidates.some(
        (c) => c.id === r.anchor_id && c.file_url === r.image_url,
      ),
  );
  diagnostics.ready_reference_count = ready.length;
  // Never silently omit an unprepared competitor and accept a different nearby point.
  if (ready.length !== candidates.length) return empty("reference_not_ready");
  const query = await embedImage(image);
  mark("model_request_ms");
  if (ready.some((r) => r.embedding_version !== query.version))
    return empty("model_version_mismatch");
  const ranked = ready.map((row) => ({
    id: row.anchor_id,
    score: cosine(query.embedding, validateEmbedding(row.embedding)),
    distance_meters: candidates.find((c) => c.id === row.anchor_id)!
      .distance_meters,
  }));
  const sorted = [...ranked].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  diagnostics.best_similarity = sorted[0]?.score ?? null;
  diagnostics.second_similarity = sorted[1]?.score ?? null;
  diagnostics.score_gap = sorted[1] ? sorted[0].score - sorted[1].score : null;
  diagnostics.best_distance_meters = sorted[0]?.distance_meters ?? null;
  const result = chooseMatch(ranked, threshold, margin);
  mark("ranking_ms");
  if (!result.match) return empty(result.reason);
  const candidate = candidates.find((c) => c.id === result.match!.id)!;
  // Detect replacement/deletion/movement while inference was in flight.
  let current: Candidate[] | null = null;
  try {
    current = await findNearbyAnchors(workspaceId, gps);
  } catch {
    current = null;
  }
  mark("candidate_recheck_ms");
  if (
    !current ||
    current.length !== candidates.length ||
    !candidates.every((old) =>
      current!.some(
        (c) =>
          c.id === old.id &&
          c.file_url === old.file_url &&
          c.distance_meters === old.distance_meters,
      ),
    )
  )
    return empty("reference_changed");
  let assets;
  try {
    assets = await db
      .selectFrom("asset")
      .select([
        "id", "name", "file_type", "file_url", "text_content", "anchor_id",
        "tag_ids", "metadata", "is_huge", "config",
      ])
      .where("anchor_id", "=", candidate.id)
      .where("file_type", "<>", "anchor")
      .where(sql<boolean>`workspace_id @> array[${workspaceId}::uuid]`)
      .orderBy("id")
      .execute();
  } catch {
    throw new MatchingError("无法读取挂载素材", 503);
  }
  mark("assets_read_ms");
  return {
    matched: true,
    reason: "matched",
    anchor: {
      id: candidate.id,
      name: candidate.name,
      distance_meters: result.match.distance_meters,
      cosine_similarity: result.match.score,
    },
    assets,
    gps_radius_meters: gps.radius,
    embedding_version: query.version,
    diagnostics: snapshot(),
  };
}
