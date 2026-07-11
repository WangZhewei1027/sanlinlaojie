import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOrgIds } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

interface SourceAsset {
  id: string;
  name: string | null;
  file_type: string;
  file_url: string | null;
  content_hash: string | null;
  text_content: string | null;
  anchor_id: string | null;
  tag_ids: string[] | null;
  is_huge: boolean | null;
  config: Record<string, unknown> | null;
  workspace_id: string[] | null;
  metadata: Record<string, unknown> | null;
}

const SELECT_COLUMNS =
  "id, name, file_type, file_url, content_hash, text_content, anchor_id, tag_ids, is_huge, config, workspace_id, metadata";

/**
 * 复制单个/多个素材。新素材复用源的 file_url / content_hash（不重复上传存储，
 * 天然满足全局去重），坐标在原位置上加一个小偏移；多选复制套用同一偏移，保持相对布局。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
    const offsetMeters: number =
      typeof body?.offsetMeters === "number" && body.offsetMeters > 0
        ? body.offsetMeters
        : 4;

    if (ids.length === 0) {
      return NextResponse.json({ error: "缺少 ids" }, { status: 400 });
    }

    const { data: sources, error: fetchError } = await supabase
      .from("asset")
      .select(SELECT_COLUMNS)
      .in("id", ids);

    if (fetchError) throw fetchError;
    if (!sources || sources.length === 0) {
      return NextResponse.json({ error: "资源不存在" }, { status: 404 });
    }

    // 鉴权：super_admin 放行；否则要求对涉及的每个 org 都有 org.assets.write。
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!isSuperAdmin(userData?.role as string | undefined)) {
      const allWorkspaceIds = Array.from(
        new Set(
          (sources as SourceAsset[]).flatMap((a) => a.workspace_id ?? []),
        ),
      );
      const orgIds = await getWorkspaceOrgIds(supabase, allWorkspaceIds);

      const deny = async (msg: string) => {
        await logError(supabase, {
          userId: user.id,
          method: "POST",
          path: "/api/assets/copy",
          status: 403,
          message: msg,
          context: { orgIds },
        });
        return NextResponse.json({ error: "权限不足" }, { status: 403 });
      };

      if (orgIds.length === 0) {
        return deny("权限不足: 资产无有效 org 归属");
      }

      const { data: memberships } = await supabase
        .from("organization_member")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .in("organization_id", orgIds);

      const roleByOrg = new Map(
        (memberships ?? []).map((m) => [
          m.organization_id as string,
          m.role as string,
        ]),
      );

      for (const orgId of orgIds) {
        if (!hasOrgPermission(roleByOrg.get(orgId), "org.assets.write")) {
          return deny("权限不足: org.assets.write");
        }
      }
    }

    // 用第一个带坐标素材的纬度算一次偏移量（度），所有副本套用同一偏移，保持相对布局。
    const refLat =
      (sources as SourceAsset[])
        .map((a) => a.metadata?.latitude)
        .find((v): v is number => typeof v === "number") ?? 0;
    const dLat = offsetMeters / 111320;
    const dLng =
      offsetMeters / (111320 * Math.cos((refLat * Math.PI) / 180) || 111320);

    const insertPayloads = (sources as SourceAsset[]).map((src) => {
      const lng = src.metadata?.longitude;
      const lat = src.metadata?.latitude;
      const hasCoords = typeof lng === "number" && typeof lat === "number";

      const newLng = hasCoords ? (lng as number) + dLng : undefined;
      const newLat = hasCoords ? (lat as number) + dLat : undefined;

      const metadata = hasCoords
        ? { ...(src.metadata ?? {}), longitude: newLng, latitude: newLat }
        : src.metadata ?? {};

      return {
        workspace_id: src.workspace_id ?? [],
        created_by: user.id,
        file_type: src.file_type,
        file_url: src.file_url,
        content_hash: src.content_hash,
        text_content: src.text_content,
        anchor_id: src.anchor_id,
        tag_ids: src.tag_ids,
        is_huge: src.is_huge ?? false,
        config: src.config ?? {},
        name: src.name ? `${src.name} 副本` : null,
        metadata,
        location: hasCoords ? `POINT(${newLng} ${newLat})` : null,
      };
    });

    const { data, error: insertError } = await supabase
      .from("asset")
      .insert(insertPayloads)
      .select(
        "id, name, file_type, file_url, text_content, anchor_id, tag_ids, metadata, workspace_id, is_huge, config, content_hash",
      );

    if (insertError) throw insertError;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("复制资产失败:", error);
    await logError(supabase, {
      method: "POST",
      path: "/api/assets/copy",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "复制资源失败" }, { status: 500 });
  }
}
