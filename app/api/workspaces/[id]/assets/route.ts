import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { NextResponse } from "next/server";
import { getUserContext, getWorkspaceOrgId } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: workspaceId } = await params;

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 特定类型过滤（如 "anchor"）
    const requireLocation = searchParams.get("requireLocation") === "true"; // 是否只返回有坐标的

    // 查询该 workspace 下的 assets
    // 使用 @> 运算符检查 workspace_id 数组是否包含当前 workspace。
    // 分页拉全量，避免 PostgREST 默认 1000 行上限截断。
    const { data, error } = await fetchAllRows(() => {
      let query = supabase
        .from("asset")
        .select("*")
        .contains("workspace_id", [workspaceId]);

      // 如果需要，过滤特定类型
      if (type) {
        query = query.eq("file_type", type);
      }

      // 如果需要，只返回有坐标的资源
      if (requireLocation) {
        query = query.not("location", "is", null);
      }

      return query;
    });

    if (error) {
      console.error("查询 assets 失败:", error);
      return NextResponse.json({ error: "查询资源失败" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取 assets 失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 创建资产（需对该 workspace 所属 org 有 org.assets.write；viewer 被拒）
// 承接原 lib/upload/service.ts 的前端直连插入，把 DB 写入移到服务端做鉴权。
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id: workspaceId } = await params;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const orgId = await getWorkspaceOrgId(supabase, workspaceId);
    if (!orgId) {
      return NextResponse.json({ error: "工作空间不存在" }, { status: 404 });
    }

    const { globalRole, orgRole } = await getUserContext(supabase, user.id, orgId);
    if (
      !isSuperAdmin(globalRole) &&
      !hasOrgPermission(orgRole, "org.assets.write")
    ) {
      await logError(supabase, {
        userId: user.id,
        method: "POST",
        path: `/api/workspaces/${workspaceId}/assets`,
        status: 403,
        message: "权限不足: org.assets.write",
        context: { orgRole, orgId },
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      file_type,
      file_url,
      text_content,
      location,
      tag_ids,
      metadata,
      anchor_id,
      is_huge,
      config,
    } = body ?? {};

    if (!file_type) {
      return NextResponse.json({ error: "缺少 file_type" }, { status: 400 });
    }

    // 白名单字段；workspace_id / created_by 由服务端定，不信任 body
    const insertPayload: Record<string, unknown> = {
      workspace_id: [workspaceId],
      created_by: user.id,
      file_type,
    };
    if (name !== undefined) insertPayload.name = name;
    if (file_url !== undefined) insertPayload.file_url = file_url;
    if (text_content !== undefined) insertPayload.text_content = text_content;
    if (location !== undefined) insertPayload.location = location;
    if (tag_ids !== undefined) insertPayload.tag_ids = tag_ids;
    if (metadata !== undefined) insertPayload.metadata = metadata;
    if (anchor_id !== undefined) insertPayload.anchor_id = anchor_id;
    if (is_huge !== undefined) insertPayload.is_huge = is_huge;
    if (config !== undefined) insertPayload.config = config;

    const { data, error } = await supabase
      .from("asset")
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("创建资产失败:", error);
    await logError(supabase, {
      method: "POST",
      path: `/api/workspaces/${workspaceId}/assets`,
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "创建资源失败" }, { status: 500 });
  }
}
