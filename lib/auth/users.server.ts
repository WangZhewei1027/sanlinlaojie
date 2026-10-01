import "server-only";
import bcrypt from "bcryptjs";
import { db, sql } from "@/lib/db";

// Direct account management on the `auth` schema, for the flows that used the
// Supabase admin API: phone sign-up / reset (after the SMS check) and the
// super-admin "create user" / "delete user" routes. Writes go straight to the
// tables Better Auth reads, using the same bcrypt format as lib/auth/server.ts.
//
// Inserting into auth.users fires handle_new_user(), which creates the
// public.users row, the personal organization and the default workspace.

const BCRYPT_ROUNDS = 10;
const CREDENTIAL_PROVIDER = "credential";

export class UserExistsError extends Error {
  constructor(email: string) {
    super(`User already exists: ${email}`);
    this.name = "UserExistsError";
  }
}

export async function findAuthUserByEmail(
  email: string,
): Promise<{ id: string; email: string } | null> {
  const row = await db
    .selectFrom("auth.users")
    .select(["id", "email"])
    .where("email", "=", email.trim().toLowerCase())
    .executeTakeFirst();
  return row ?? null;
}

/**
 * Create an email/password account. Throws UserExistsError when the email is
 * taken. Returns the new user id (same id Better Auth will see in sessions).
 */
export async function createUserWithPassword(params: {
  email: string;
  password: string;
  name?: string | null;
  emailVerified?: boolean;
}): Promise<{ id: string }> {
  const email = params.email.trim().toLowerCase();
  // "" becomes NULL in public.users via handle_new_user(); the personal
  // organization is then named after the email's local part.
  const name = params.name?.trim() ?? "";
  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom("auth.users")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();
    if (existing) throw new UserExistsError(email);

    const user = await trx
      .insertInto("auth.users")
      .values({
        email,
        name,
        email_verified: params.emailVerified ?? false,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    await trx
      .insertInto("auth.account")
      .values({
        user_id: user.id,
        account_id: user.id,
        provider_id: CREDENTIAL_PROVIDER,
        password: passwordHash,
      })
      .execute();

    return { id: user.id };
  });
}

/** Replace the password of an existing account (creates the credential row if missing). */
export async function setUserPassword(
  userId: string,
  password: string,
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const updated = await db
    .updateTable("auth.account")
    .set({ password: passwordHash, updated_at: sql`now()` })
    .where("user_id", "=", userId)
    .where("provider_id", "=", CREDENTIAL_PROVIDER)
    .executeTakeFirst();

  if (Number(updated.numUpdatedRows) === 0) {
    await db
      .insertInto("auth.account")
      .values({
        user_id: userId,
        account_id: userId,
        provider_id: CREDENTIAL_PROVIDER,
        password: passwordHash,
      })
      .execute();
  }
}

/**
 * Delete an account. Cascades through public.users and everything hanging off
 * it (memberships, pins, assignments); organizations the user owns must be
 * handled first (lib/user-deletion.server.ts). Returns false if no such user.
 */
export async function deleteAuthUser(userId: string): Promise<boolean> {
  const result = await db
    .deleteFrom("auth.users")
    .where("id", "=", userId)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}
