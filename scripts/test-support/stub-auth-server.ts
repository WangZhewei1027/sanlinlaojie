/** Test double for lib/auth/server.ts (route tests only; installed by install-route-stubs.ts). */
export interface StubSessionUser {
  id: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
}

const store = globalThis as typeof globalThis & { __teamWorkbenchSessionUser?: StubSessionUser | null };

export type SessionUser = StubSessionUser;

export function setStubSessionUser(user: StubSessionUser | null): void {
  store.__teamWorkbenchSessionUser = user;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return store.__teamWorkbenchSessionUser ?? null;
}

export function getAuth(): never {
  throw new Error("Better Auth is not available in route tests");
}
