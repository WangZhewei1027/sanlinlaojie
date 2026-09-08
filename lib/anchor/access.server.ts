import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  getUserContext,
  getWorkspaceOrgId,
  getWorkspaceOrgIds,
} from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { MatchingError, requireUuid } from "@/lib/anchor-matching";

type Supa = Awaited<ReturnType<typeof createClient>>;
export async function requireAnchorAccess(id: string, write: boolean) {
  requireUuid(id, "anchor_id");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new MatchingError("未授权", 401);
  const { data: asset, error } = await supabase
    .from("asset")
    .select("id,file_type,file_url,workspace_id")
    .eq("id", id)
    .single();
  if (error || !asset || asset.file_type !== "anchor")
    throw new MatchingError("匹配点不存在", 404);
  const orgIds = await getWorkspaceOrgIds(supabase, asset.workspace_id ?? []);
  if (!orgIds.length) throw new MatchingError("匹配点无有效工作空间", 403);
  for (const orgId of orgIds) {
    const ctx = await getUserContext(supabase, user.id, orgId);
    if (
      !isSuperAdmin(ctx.globalRole) &&
      !hasOrgPermission(ctx.orgRole, write ? "org.assets.write" : "org.view")
    )
      throw new MatchingError("权限不足", 403);
  }
  return { supabase, asset };
}
export async function validateAnchorLink(
  supabase: Supa,
  anchorId: unknown,
  fileType: string,
  workspaces: string[],
  assetId?: string,
) {
  if (anchorId === null || anchorId === undefined) return;
  requireUuid(anchorId, "anchor_id");
  if (fileType === "anchor" || anchorId === assetId)
    throw new MatchingError("匹配点不能挂载匹配点");
  const { data: parent } = await supabase
    .from("asset")
    .select("id,file_type,workspace_id")
    .eq("id", anchorId)
    .single();
  if (
    !parent ||
    parent.file_type !== "anchor" ||
    !workspaces.length ||
    !workspaces.every((id) => parent.workspace_id?.includes(id))
  )
    throw new MatchingError("请选择素材所在工作空间内的匹配点");
}
/** Mini program anonymous access is opt-in per workspace. The public key is NOT a user identity. */
export async function authorizeRecognition(
  request: Request,
  workspaceId: string,
) {
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const publicCredential =
    request.headers.get("apikey") === publicKey || token === publicKey;
  const allowlist = (process.env.ANCHOR_PUBLIC_WORKSPACE_IDS || "")
    .split(",")
    .map((s) => s.trim());
  if (
    publicCredential &&
    allowlist.includes(workspaceId) &&
    (!token || token === publicKey)
  )
    return;
  if (!token || token === publicKey)
    throw new MatchingError("未授权或工作空间未开放小程序匹配", 401);
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publicKey,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) throw new MatchingError("登录已失效", 401);
  const orgId = await getWorkspaceOrgId(supabase, workspaceId);
  if (!orgId) throw new MatchingError("工作空间不可用", 403);
  const ctx = await getUserContext(supabase, user.id, orgId);
  if (isSuperAdmin(ctx.globalRole)) return;
  if (!hasOrgPermission(ctx.orgRole, "org.view"))
    throw new MatchingError("权限不足", 403);
  if (ctx.orgRole === "owner" || ctx.orgRole === "admin") return;
  const { data: assignment } = await supabase
    .from("workspace_assignment")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!assignment) throw new MatchingError("未分配此工作空间", 403);
}
