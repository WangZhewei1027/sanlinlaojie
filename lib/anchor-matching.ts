/** Shared protocol and pure matching logic. No browser or server dependencies. */
export const EMBEDDING_DIM = 8448;
export const MAX_MATCH_IMAGE_BYTES = 4 * 1024 * 1024;
export const MATCH_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export class MatchingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function finiteNumber(
  value: unknown,
  min: number,
  max: number,
  name: string,
): number {
  if (typeof value !== "number" && typeof value !== "string")
    throw new MatchingError(`Invalid ${name}`);
  if (typeof value === "string" && !value.trim())
    throw new MatchingError(`Missing ${name}`);
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max)
    throw new MatchingError(`Invalid ${name}`);
  return result;
}
export function requireUuid(value: unknown, name = "workspace_id"): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new MatchingError(`Invalid ${name}`);
  return value;
}
export function validateEmbedding(value: unknown): number[] {
  if (
    !Array.isArray(value) ||
    value.length !== EMBEDDING_DIM ||
    value.some((v) => typeof v !== "number" || !Number.isFinite(v))
  )
    throw new MatchingError("Invalid model descriptor", 502);
  const norm = Math.sqrt(value.reduce((sum, n) => sum + n * n, 0));
  if (!Number.isFinite(norm) || norm < 1e-8)
    throw new MatchingError("Invalid model descriptor", 502);
  return value.map((n) => n / norm);
}
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
export function parseGps(form: FormData, now = Date.now()) {
  if (form.get("coordinate_system") !== "wgs84")
    throw new MatchingError("coordinate_system must be wgs84");
  const latitude = finiteNumber(form.get("latitude"), -90, 90, "latitude");
  const longitude = finiteNumber(form.get("longitude"), -180, 180, "longitude");
  const accuracy = finiteNumber(
    form.get("accuracy"),
    0,
    100,
    "accuracy (0–100 metres)",
  );
  const timestamp = finiteNumber(
    form.get("gps_timestamp"),
    now - 30000,
    now + 5000,
    "gps_timestamp (fresh Unix milliseconds)",
  );
  return {
    latitude,
    longitude,
    accuracy,
    timestamp,
    radius: Math.min(200, Math.max(75, accuracy * 2)),
  };
}
export type RankedAnchor = {
  id: string;
  score: number;
  distance_meters: number;
};
export function chooseMatch(
  ranked: RankedAnchor[],
  threshold: number,
  margin: number,
) {
  const sorted = [...ranked].sort(
    (a, b) => b.score - a.score || a.id.localeCompare(b.id),
  );
  const best = sorted[0];
  if (!best || best.score < threshold)
    return { match: null, reason: "below_threshold" as const };
  if (sorted[1] && best.score - sorted[1].score < margin)
    return { match: null, reason: "ambiguous" as const };
  return { match: best, reason: "matched" as const };
}
export function cosine(a: number[], b: number[]) {
  return Math.max(
    -1,
    Math.min(
      1,
      a.reduce((sum, n, i) => sum + n * b[i], 0),
    ),
  );
}
