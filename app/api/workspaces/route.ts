import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { loadActor, loadWorkspaceAccessMany } from "@/lib/content-model/access.server";
import { failure } from "@/lib/content-model/http.server";
import { isUuid } from "@/lib/content-model/input";
import { createCollection } from "@/lib/content-model/projects.server";

/**
 * Legacy collection list/create (map collections are stored as workspace
 * rows). Every member of an organization sees all of its collections; the
 * team role, not workspace_assignment, decides access.
 */

/** Adds the caller's team-derived role, capability flags and archive/cutover state. */
async function withCapabilities<T extends { id: string }>(userId: string, rows: T[]) {
  const access = await loadWorkspaceAccessMany(db, await loadActor(db, userId), rows.map((r) => r.id));
  return rows.map((row) => {
    const a = access.get(row.id);
    return {
      ...row,
      archived_at: a?.workspace.archived_at ?? null,
      project_role: a?.projectRole ?? null,
      content_model_state: a?.org.content_model_state ?? "legacy",
      capabilities: a?.capabilities ?? null,
    };
  });
}

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    // 支持按 organization_id 过滤
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organization_id");
    if (organizationId && !isUuid(organizationId)) return NextResponse.json({ data: [] });

    // super_admin 可查看任意组织的 workspace（资源清理等全局管理页面需要全量）
    const actor = await loadActor(db, user.id);
    if (actor.superAdmin) {
      let query = db.selectFrom("workspace").selectAll();
      if (organizationId) {
        query = query.where("organization_id", "=", organizationId);
      }
      const allWorkspaces = await query.execute();
      return NextResponse.json({ data: await withCapabilities(user.id, allWorkspaces) });
    }

    // 组织成员（含 viewer）可见本组织全部合集
    let query = db
      .selectFrom("workspace as w")
      .innerJoin("organization_member as m", (join) => join.onRef("m.organization_id", "=", "w.organization_id").on("m.user_id", "=", user.id))
      .select(["w.id", "w.name", "w.description", "w.create_date", "w.organization_id"]);
    if (organizationId) query = query.where("w.organization_id", "=", organizationId);
    const data = await query.orderBy("w.create_date", "desc").orderBy("w.id").execute();

    return NextResponse.json({ data: await withCapabilities(user.id, data) });
  } catch (error) {
    console.error("获取 workspace 失败:", error);
    return NextResponse.json({ error: "获取工作空间失败" }, { status: 500 });
  }
}

/** POST { name, description?, organization_id } → 201 { data: WorkspaceDto } (any team writer). */
export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const { name, description, organization_id } = body ?? {};

    if (!organization_id) {
      return NextResponse.json(
        { error: "缺少 organization_id" },
        { status: 400 },
      );
    }
    if (!isUuid(organization_id)) return NextResponse.json({ error: "组织不存在" }, { status: 404 });

    if (!name) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    const data = await createCollection(await loadActor(db, user.id), organization_id, {
      name,
      ...(description ? { description } : {}),
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return failure(error, { method: "POST", path: "/api/workspaces", userId: user.id });
  }
}
