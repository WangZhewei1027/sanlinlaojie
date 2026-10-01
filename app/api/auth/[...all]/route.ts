import { getAuth } from "@/lib/auth/server";
import { toNextJsHandler } from "better-auth/next-js";

// All Better Auth endpoints (/api/auth/sign-in/email, /api/auth/get-session, …).
// Resolved per request so the instance is created lazily (see lib/auth/server.ts).
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
