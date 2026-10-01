import "server-only";
import { db } from "@/lib/db";

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
export async function logError(entry: LogErrorEntry): Promise<void> {
  try {
    await db
      .insertInto("error_log")
      .values({
        user_id: entry.userId ?? null,
        scope: "api",
        method: entry.method ?? null,
        path: entry.path ?? null,
        status: entry.status ?? null,
        message:
          entry.message == null
            ? null
            : String(entry.message).slice(0, MAX_MESSAGE),
        context: entry.context ? JSON.stringify(entry.context) : null,
      })
      .execute();
  } catch {
    // swallow — logging must not break the request
  }
}

/** Alias kept for call sites written against the Supabase-era API. */
export const logErrorSafe = logError;
