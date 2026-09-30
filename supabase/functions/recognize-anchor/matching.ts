import { Config, Diagnostics, RecognitionError, cosine, finiteNumber, normalized, parseGps, timed, withBudget, readBounded, isTimeout } from "./protocol.ts";
import { embedImage } from "./model.ts";

interface Candidate {
  id: string;
  name: string;
  file_url: string;
  distance_meters: number;
  reference_image_url: string | null;
  reference_status: string | null;
  embedding_version: string | null;
  embedding: unknown;
}
interface Context { allowed: boolean; candidates: Candidate[]; reference_snapshot: unknown[] }
interface Finalized { unchanged: boolean; assets: unknown[] }
async function rpc<T>(name: string, args: Record<string, unknown>, config: Config, fetcher: typeof fetch): Promise<T> {
  if (!config.supabaseUrl || !config.serviceRoleKey)
    throw new RecognitionError("匹配数据库尚未配置", 503, "database_unconfigured");
  try {
    return await withBudget(config, 6000, async (signal) => {
      const response = await fetcher(`${config.supabaseUrl!.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
        method: "POST", headers: { apikey: config.serviceRoleKey!, Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json" }, body: JSON.stringify(args), signal, redirect: "error",
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new RecognitionError("匹配查询未就绪，请检查数据库迁移", 503, "database_unavailable");
      }
      try {
        const bytes = await readBounded(response.body, Infinity, signal);
        return JSON.parse(new TextDecoder().decode(bytes)) as T;
      } catch (error) {
        if (isTimeout(error)) throw error;
        throw new RecognitionError("匹配数据库返回无效", 503, "database_unavailable");
      }
    });
  } catch (error) {
    if (error instanceof RecognitionError) throw error;
    throw new RecognitionError(isTimeout(error) ? "匹配数据库请求超时" : "匹配数据库连接失败", 503, "database_unavailable");
  }
}
export async function recognize(workspace: string, form: FormData, image: Blob, config: Config,
  diagnostics: Diagnostics, fetcher: typeof fetch) {
  const startedAt = performance.now();
  try {
    diagnostics.phase = "validation";
    const gps = parseGps(form);
    if (!config.threshold) throw new RecognitionError("请先配置视觉匹配阈值", 503, "threshold_unconfigured");
    const threshold = finiteNumber(config.threshold, -1, 1, "SAGE_MATCH_THRESHOLD");
    const margin = finiteNumber(config.margin ?? "0.03", 0, 2, "SAGE_MATCH_MARGIN");
    Object.assign(diagnostics, { candidate_count: 0, ready_reference_count: 0, threshold, required_margin: margin,
      best_similarity: null, second_similarity: null, score_gap: null, best_distance_meters: null });
    diagnostics.timings_ms.validation_ms = Math.round(performance.now() - startedAt);
    const gpsArgs = { p_workspace_id: workspace, p_lat: gps.latitude, p_lng: gps.longitude, p_radius: gps.radius };
    diagnostics.phase = "database_context";
    const context = await timed(diagnostics, "database_context_ms", () =>
      rpc<Context>("prepare_anchor_match_context", gpsArgs, config, fetcher));
    if (!context || typeof context.allowed !== "boolean")
      throw new RecognitionError("匹配查询返回无效", 503, "database_unavailable");
    if (!context.allowed) throw new RecognitionError("工作空间请求过于频繁，请稍后重试", 429, "workspace_rate_limited", 60000);
    if (!Array.isArray(context.candidates) || !Array.isArray(context.reference_snapshot))
      throw new RecognitionError("匹配查询返回无效", 503, "database_unavailable");
    const candidates = context.candidates;
    diagnostics.candidate_count = candidates.length;
    const empty = (reason: string) => ({ matched: false, reason, anchor: null, assets: [], gps_radius_meters: gps.radius });
    if (!candidates.length) return empty("no_nearby_anchor");
    if (candidates.length > 200) throw new RecognitionError("附近匹配点过多，请缩小工作空间", 422, "too_many_candidates");
    const ready = candidates.filter((c) => c.reference_status === "ready" && c.reference_image_url === c.file_url);
    diagnostics.ready_reference_count = ready.length;
    if (ready.length !== candidates.length) return empty("reference_not_ready");
    diagnostics.phase = "model";
    const query = await timed(diagnostics, "model_request_ms", () => embedImage(image, config, diagnostics, fetcher));
    if (ready.some((c) => c.embedding_version !== query.version)) return empty("model_version_mismatch");
    diagnostics.phase = "ranking";
    const rankingStart = performance.now();
    const ranked = ready.map((c) => ({ ...c, score: cosine(query.embedding, normalized(c.embedding)) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const best = ranked[0];
    Object.assign(diagnostics, { best_similarity: best.score, second_similarity: ranked[1]?.score ?? null,
      score_gap: ranked[1] ? best.score - ranked[1].score : null, best_distance_meters: best.distance_meters });
    diagnostics.timings_ms.ranking_ms = Math.round(performance.now() - rankingStart);
    if (best.score < threshold) return empty("below_threshold");
    if (ranked[1] && best.score - ranked[1].score < margin) return empty("ambiguous");
    diagnostics.phase = "database_finalize";
    const finalized = await timed(diagnostics, "database_finalize_ms", () => rpc<Finalized>("finalize_anchor_match", {
      ...gpsArgs, p_anchor_id: best.id, p_reference_snapshot: context.reference_snapshot,
    }, config, fetcher));
    if (!finalized || typeof finalized.unchanged !== "boolean" || !Array.isArray(finalized.assets))
      throw new RecognitionError("匹配复检返回无效", 503, "database_unavailable");
    if (!finalized.unchanged) return empty("reference_changed");
    diagnostics.phase = "matched";
    return { matched: true, reason: "matched", anchor: { id: best.id, name: best.name,
      distance_meters: best.distance_meters, cosine_similarity: best.score }, assets: finalized.assets,
      gps_radius_meters: gps.radius, embedding_version: query.version };
  } finally { diagnostics.timings_ms.matching_total_ms = Math.round(performance.now() - startedAt); }
}
