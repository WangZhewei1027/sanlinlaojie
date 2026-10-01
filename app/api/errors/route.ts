import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

const MAX_MESSAGE = 2000;
const MAX_PATH = 500;

/**
 * Client error sink. Captures uncaught errors / rejections / fetch failures
 * from the browser (including on logged-out pages), whitelists + truncates
 * fields, and writes scope='client' rows to error_log. Logs `user_id` when a
 * session exists, null otherwise. Always returns 200-ish so the reporter never
 * cascades into another error.
 *
 * NOTE: intentionally does not gate on auth so public-page crashes are still
 * captured; this trades a small spam surface for coverage. Add rate-limiting
 * here if abuse becomes a concern.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    const body = (await request.json().catch(() => ({}))) as {
      method?: unknown;
      path?: unknown;
      status?: unknown;
      message?: unknown;
      context?: unknown;
    };

    await db
      .insertInto("error_log")
      .values({
        user_id: user?.id ?? null,
        scope: "client",
        method:
          typeof body.method === "string" ? body.method.slice(0, 16) : null,
        path:
          typeof body.path === "string" ? body.path.slice(0, MAX_PATH) : null,
        status: Number.isInteger(body.status) ? (body.status as number) : null,
        message:
          typeof body.message === "string"
            ? body.message.slice(0, MAX_MESSAGE)
            : null,
        context:
          body.context && typeof body.context === "object"
            ? JSON.stringify(body.context)
            : null,
      })
      .execute();

    return NextResponse.json({ ok: true });
  } catch {
    // never let the error sink itself error out loudly
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
