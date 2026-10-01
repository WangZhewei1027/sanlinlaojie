import { createAuthClient } from "better-auth/react";

// Browser-side auth client (same-origin /api/auth). Replaces
// `createClient().auth.*` from supabase-js in Client Components:
//   authClient.useSession()                → { data: { user, session } | null, isPending }
//   authClient.signIn.email({ email, password })
//   authClient.signUp.email({ email, password, name })
//   authClient.signOut()
//   authClient.requestPasswordReset({ email, redirectTo })
//   authClient.resetPassword({ newPassword, token })
//   authClient.changePassword({ currentPassword, newPassword })
// Every call resolves to { data, error } — it never throws on auth errors.
export const authClient = createAuthClient();

export type AuthClientError = NonNullable<
  Awaited<ReturnType<typeof authClient.signIn.email>>["error"]
>;

/** 当前登录用户（useSession().data?.user / getSession() 里的 user）：{ id, email, name, image, emailVerified, … } */
export type SessionUser = typeof authClient.$Infer.Session.user;
