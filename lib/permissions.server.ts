import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetch the caller's global role (users.role) and, if an org is given, their
 * membership role in that org (organization_member.role). Shared by every API
 * route that gates on roles so the lookup logic lives in one place.
 */
export async function getUserContext(
  supabase: SupabaseClient,
  userId: string,
  orgId?: string | null,
): Promise<{ globalRole: string | null; orgRole: string | null }> {
  const userPromise = supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .single();

  const membershipPromise = orgId
    ? supabase
        .from("organization_member")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .single()
    : Promise.resolve({ data: null as { role?: string } | null });

  const [{ data: userData }, { data: membership }] = await Promise.all([
    userPromise,
    membershipPromise,
  ]);

  return {
    globalRole: (userData?.role as string | undefined) ?? null,
    orgRole: (membership?.role as string | undefined) ?? null,
  };
}

/** Resolve the organization a workspace belongs to (null if not found). */
export async function getWorkspaceOrgId(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("workspace")
    .select("organization_id")
    .eq("id", workspaceId)
    .single();
  return (data?.organization_id as string | undefined) ?? null;
}

/** Distinct organization ids for a set of workspaces. */
export async function getWorkspaceOrgIds(
  supabase: SupabaseClient,
  workspaceIds: string[],
): Promise<string[]> {
  if (workspaceIds.length === 0) return [];
  const { data } = await supabase
    .from("workspace")
    .select("organization_id")
    .in("id", workspaceIds);
  return Array.from(
    new Set((data ?? []).map((w) => w.organization_id as string)),
  );
}
