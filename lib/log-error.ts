import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const MAX_MESSAGE = 2000;

export interface LogErrorEntry {
  userId?: string | null;
  method?: string | null;
  path?: string | null;
  status?: number | null;
  message?: unknown;
  context?: Record<string, unknown> | null;
}

/**
 * Record an API-side failure into public.error_log. Fire-and-forget: it never
 * throws, so callers can `await logError(...)` safely without a try/catch — a
 * logging failure must never affect the main response.
 */
export async function logError(
  supabase: SupabaseClient,
  entry: LogErrorEntry,
): Promise<void> {
  try {
    await supabase.from("error_log").insert({
      user_id: entry.userId ?? null,
      scope: "api",
      method: entry.method ?? null,
      path: entry.path ?? null,
      status: entry.status ?? null,
      message:
        entry.message == null
          ? null
          : String(entry.message).slice(0, MAX_MESSAGE),
      context: entry.context ?? null,
    });
  } catch {
    // swallow — logging must not break the request
  }
}

/**
 * Same as logError but creates its own server client, so it can be called from
 * a route's catch block where the request-scoped client is out of scope.
 * Never throws.
 */
export async function logErrorSafe(entry: LogErrorEntry): Promise<void> {
  try {
    const supabase = await createClient();
    await logError(supabase, entry);
  } catch {
    // swallow
  }
}
