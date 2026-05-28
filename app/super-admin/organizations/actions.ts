"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const VALID_MINIAPP_STYLES = ["plain_white", "dialog_decorated"] as const;

import type { OrgConfig } from "./types";

interface UpdateOrgPayload {
  name?: string;
  description?: string | null;
  map_center?: { lat: number; lng: number } | null;
  allowed_file_types?: string[] | null;
  config?: OrgConfig;
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("未授权");

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (userData?.role !== "super_admin") throw new Error("权限不足");
  return supabase;
}

export async function updateOrganization(
  id: string,
  payload: UpdateOrgPayload,
): Promise<{ error?: string }> {
  try {
    const supabase = await requireSuperAdmin();
    const safePayload = { ...payload };
    if (safePayload.config) {
      const safeConfig = { ...safePayload.config };
      if (
        safeConfig.text_asset_miniapp_style !== undefined &&
        !VALID_MINIAPP_STYLES.includes(
          safeConfig.text_asset_miniapp_style as (typeof VALID_MINIAPP_STYLES)[number],
        )
      ) {
        delete safeConfig.text_asset_miniapp_style;
      }
      safePayload.config = safeConfig;
    }
    const { error } = await supabase
      .from("organization")
      .update(safePayload)
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/super-admin/organizations");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "操作失败" };
  }
}

export async function deleteOrganization(
  id: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await requireSuperAdmin();
    const { error } = await supabase.from("organization").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/super-admin/organizations");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "操作失败" };
  }
}
