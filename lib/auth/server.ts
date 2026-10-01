import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { sendMail, isMailConfigured } from "@/lib/email";

// Better Auth is the session + email/password provider that replaced Supabase
// Auth. Tables live in the `auth` schema (db/schema.sql); the `fields` maps
// below translate Better Auth's camelCase field names onto those snake_case
// columns, so both sides must change together.
//
// Password hashes are bcrypt so the hashes exported from Supabase keep
// working unchanged — users did not have to reset their passwords.
//
// Phone-number accounts are ordinary email/password accounts under a virtual
// email (lib/phone-email.ts); their creation and password reset bypass the
// HTTP endpoints and go through lib/auth/users.server.ts after the Aliyun SMS
// check, exactly like the Supabase admin API was used before.

const BCRYPT_ROUNDS = 10;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  appName: "三林老街",
  baseURL: siteUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [siteUrl, ...(process.env.AUTH_TRUSTED_ORIGINS?.split(",") ?? [])]
    .map((s) => s.trim())
    .filter(Boolean),
  database: { db, type: "postgres", schemaName: "auth" },
  advanced: {
    database: { generateId: "uuid" },
    // Running behind Caddy, which terminates TLS and forwards X-Forwarded-*.
    useSecureCookies: siteUrl.startsWith("https://"),
  },
  user: {
    modelName: "users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "session",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  account: {
    modelName: "account",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "verification",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    // Only enforce confirmation when we can actually send the mail.
    requireEmailVerification:
      process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true" && isMailConfigured(),
    password: {
      hash: (password) => bcrypt.hash(password, BCRYPT_ROUNDS),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "重置密码 / Reset your password",
        text: `点击以下链接重置密码（1 小时内有效）：\n${url}\n\n如果不是你本人操作，请忽略本邮件。`,
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60,
  },
  emailVerification: {
    sendOnSignUp: isMailConfigured(),
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "确认邮箱 / Confirm your email",
        text: `点击以下链接完成邮箱确认：\n${url}`,
      });
    },
  },
  // `name` is required by Better Auth but the sign-up form doesn't collect one;
  // clients send "" and handle_new_user() stores it as NULL (as before).
  plugins: [nextCookies()],
});

export type SessionUser = typeof auth.$Infer.Session.user;

/**
 * The signed-in user for the current request, or null. Replaces
 * `supabase.auth.getUser()` in route handlers, server components and server
 * actions. Reads cookies via next/headers, so it must be awaited inside a
 * request scope (in `cacheComponents` mode: inside a Suspense boundary or a
 * route handler).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
