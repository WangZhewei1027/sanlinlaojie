import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { MatchingError, requireUuid } from "@/lib/anchor-matching";

type Supa = SupabaseClient;

/** Public matching endpoints validate the target asset without requiring login. */
export async function getMatchingAnchor(id: string) {
  requireUuid(id, "anchor_id");
  const { data: asset, error } = await createAdminClient()
    .from("asset")
    .select("id,file_type,file_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new MatchingError("无法查询匹配点", 503);
  if (!asset || asset.file_type !== "anchor")
    throw new MatchingError("匹配点不存在", 404);
  return asset;
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
