import { auth } from "@/lib/auth/server";
import { toNextJsHandler } from "better-auth/next-js";

// All Better Auth endpoints (/api/auth/sign-in/email, /api/auth/get-session, …).
export const { GET, POST } = toNextJsHandler(auth);
