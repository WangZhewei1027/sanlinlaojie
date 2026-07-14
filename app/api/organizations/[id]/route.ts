import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

// 获取单个 organization 详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("organization")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取 organization 失败:", error);
    return NextResponse.json({ error: "获取组织失败" }, { status: 500 });
  }
}

// 更新 organization（需 org.settings：owner 或 super_admin）
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { globalRole, orgRole } = await getUserContext(supabase, user.id, id);

    if (!isSuperAdmin(globalRole) && !hasOrgPermission(orgRole, "org.settings")) {
      await logError(supabase, {
        userId: user.id,
        method: "PUT",
        path: `/api/organizations/${id}`,
        status: 403,
        message: "权限不足: org.settings",
        context: { orgRole },
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, map_center, allowed_file_types, config } = body;

    const updatePayload: Record<string, unknown> = { name, description };

    // 组织配置字段（与 super-admin 的 updateOrganization action 同语义）：
    // 仅在请求携带时更新，且做形状校验，防止写入脏数据
    if (map_center !== undefined) {
      const validCenter =
        map_center === null ||
        (typeof map_center?.lat === "number" &&
          typeof map_center?.lng === "number");
      if (!validCenter) {
        return NextResponse.json(
          { error: "无效的地图中心坐标" },
          { status: 400 },
        );
      }
      updatePayload.map_center =
        map_center === null
          ? null
          : { lat: map_center.lat, lng: map_center.lng };
    }

    if (allowed_file_types !== undefined) {
      const validTypes =
        allowed_file_types === null ||
        (Array.isArray(allowed_file_types) &&
          allowed_file_types.every((t: unknown) => typeof t === "string"));
      if (!validTypes) {
        return NextResponse.json(
          { error: "无效的文件类型配置" },
          { status: 400 },
        );
      }
      updatePayload.allowed_file_types = allowed_file_types;
    }

    if (config !== undefined) {
      if (typeof config !== "object" || config === null) {
        return NextResponse.json({ error: "无效的组织配置" }, { status: 400 });
      }
      const safeConfig = { ...config };
      if (
        safeConfig.text_asset_miniapp_style !== undefined &&
        !["plain_white", "dialog_decorated"].includes(
          safeConfig.text_asset_miniapp_style,
        )
      ) {
        delete safeConfig.text_asset_miniapp_style;
      }
      updatePayload.config = safeConfig;
    }

    const { data, error } = await supabase
      .from("organization")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("更新 organization 失败:", error);
    await logError(supabase, {
      method: "PUT",
      path: `/api/organizations/${id}`,
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "更新组织失败" }, { status: 500 });
  }
}

// 删除 organization（需 org.delete：owner 或 super_admin，且无 workspace 时）
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { globalRole, orgRole } = await getUserContext(supabase, user.id, id);

    if (!isSuperAdmin(globalRole) && !hasOrgPermission(orgRole, "org.delete")) {
      await logError(supabase, {
        userId: user.id,
        method: "DELETE",
        path: `/api/organizations/${id}`,
        status: 403,
        message: "权限不足: org.delete",
        context: { orgRole },
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    // 检查是否有关联的 workspace
    const { data: workspaces } = await supabase
      .from("workspace")
      .select("id")
      .eq("organization_id", id)
      .limit(1);

    if (workspaces && workspaces.length > 0) {
      return NextResponse.json(
        { error: "该组织下还有工作空间，请先删除所有工作空间" },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("organization").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除 organization 失败:", error);
    await logError(supabase, {
      method: "DELETE",
      path: `/api/organizations/${id}`,
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "删除组织失败" }, { status: 500 });
  }
}
