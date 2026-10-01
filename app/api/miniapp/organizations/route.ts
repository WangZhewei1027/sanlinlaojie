import { db } from "@/lib/db";
import { errorResponse, json, parseIds } from "@/lib/miniapp/request";

// Public: organization names + the mini-program-relevant subset of `config`.
//   GET /api/miniapp/organizations?ids=<uuid>,<uuid>
//   → [{ id, name, config }]
// Replaces the mini-program's direct PostgREST reads of `organization`.

// Only these config keys are consumed by the mini-program (xr-start, index
// page, shop check-in); everything else in `config` stays private.
const PUBLIC_CONFIG_KEYS = [
  "confetti_enabled",
  "shop_checkin_enabled",
  "footer_enabled",
  "text_asset_miniapp_style",
] as const;

function publicConfig(config: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!config || typeof config !== "object") return out;
  for (const key of PUBLIC_CONFIG_KEYS) {
    const value = (config as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export async function GET(request: Request) {
  try {
    const ids = parseIds(request);
    const rows = await db
      .selectFrom("organization")
      .select(["id", "name", "config"])
      .where("id", "in", ids)
      .execute();
    return json(
      rows.map((r) => ({ id: r.id, name: r.name, config: publicConfig(r.config) })),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
