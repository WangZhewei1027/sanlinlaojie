import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isSuperAdmin, hasOrgPermission } from "@/lib/permissions";

/** Helper: get current user's global role and org membership role */
async function getUserContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string,
) {
  const [{ data: userData }, { data: membership }] = await Promise.all([
    supabase.from("users").select("role").eq("user_id", userId).single(),
    supabase
      .from("organization_member")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .single(),
  ]);
  return {
    globalRole: userData?.role as string | null,
    orgRole: membership?.role as string | null,
  };
}

// 获取 organization 的成员列表
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

    const { globalRole, orgRole } = await getUserContext(supabase, user.id, id);

    // super_admin or any org member can view members
    if (
      !isSuperAdmin(globalRole) &&
      !hasOrgPermission(orgRole, "org.members.view")
    ) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("organization_member")
      .select(
        `
        id,
        role,
        created_at,
        user_id,
        users (
          user_id,
          name,
          email,
          role
        )
      `,
      )
      .eq("organization_id", id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取组织成员失败:", error);
    return NextResponse.json({ error: "获取组织成员失败" }, { status: 500 });
  }
}

// 添加成员到 organization
export async function POST(
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

    const { globalRole, orgRole } = await getUserContext(supabase, user.id, id);

    if (
      !isSuperAdmin(globalRole) &&
      !hasOrgPermission(orgRole, "org.members.add")
    ) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, role = "member" } = body;

    if (!user_id) {
      return NextResponse.json({ error: "缺少 user_id" }, { status: 400 });
    }

    if (!["owner", "admin", "member", "viewer"].includes(role)) {
      return NextResponse.json({ error: "无效的角色" }, { status: 400 });
    }

    // Only owner (or super_admin) can add owners
    if (role === "owner" && !isSuperAdmin(globalRole) && orgRole !== "owner") {
      return NextResponse.json(
        { error: "只有拥有者可以添加拥有者" },
        { status: 403 },
      );
    }

    // 检查是否已经是成员
    const { data: existing } = await supabase
      .from("organization_member")
      .select("id")
      .eq("organization_id", id)
      .eq("user_id", user_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "该用户已经是此组织的成员" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("organization_member")
      .insert({
        organization_id: id,
        user_id,
        role,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("添加组织成员失败:", error);
    return NextResponse.json({ error: "添加组织成员失败" }, { status: 500 });
  }
}

// 更新成员角色
export async function PATCH(
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

    const { globalRole, orgRole } = await getUserContext(supabase, user.id, id);

    if (
      !isSuperAdmin(globalRole) &&
      !hasOrgPermission(orgRole, "org.members.changeRole")
    ) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const body = await request.json();
    const { member_id, role } = body;

    if (!member_id) {
      return NextResponse.json({ error: "缺少 member_id" }, { status: 400 });
    }

    if (!role || !["owner", "admin", "member", "viewer"].includes(role)) {
      return NextResponse.json({ error: "无效的角色" }, { status: 400 });
    }

    // Get target member's current role
    const { data: targetMember } = await supabase
      .from("organization_member")
      .select("role, user_id")
      .eq("id", member_id)
      .eq("organization_id", id)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: "成员不存在" }, { status: 404 });
    }

    // Admin cannot modify owners
    if (
      targetMember.role === "owner" &&
      !isSuperAdmin(globalRole) &&
      orgRole !== "owner"
    ) {
      return NextResponse.json(
        { error: "无法修改拥有者角色" },
        { status: 403 },
      );
    }

    // Only owner (or super_admin) can set someone to owner
    if (role === "owner" && !isSuperAdmin(globalRole) && orgRole !== "owner") {
      return NextResponse.json(
        { error: "只有拥有者可以设置拥有者角色" },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from("organization_member")
      .update({ role })
      .eq("id", member_id)
      .eq("organization_id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("更新成员角色失败:", error);
    return NextResponse.json({ error: "更新成员角色失败" }, { status: 500 });
  }
}

// 移除组织成员
export async function DELETE(
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

    const { globalRole, orgRole } = await getUserContext(supabase, user.id, id);

    if (
      !isSuperAdmin(globalRole) &&
      !hasOrgPermission(orgRole, "org.members.remove")
    ) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const member_id = searchParams.get("member_id");

    if (!member_id) {
      return NextResponse.json({ error: "缺少 member_id" }, { status: 400 });
    }

    // Get target member's role
    const { data: targetMember } = await supabase
      .from("organization_member")
      .select("role")
      .eq("id", member_id)
      .eq("organization_id", id)
      .single();

    // Admin cannot remove owners
    if (
      targetMember?.role === "owner" &&
      !isSuperAdmin(globalRole) &&
      orgRole !== "owner"
    ) {
      return NextResponse.json({ error: "无法移除拥有者" }, { status: 403 });
    }

    const { error } = await supabase
      .from("organization_member")
      .delete()
      .eq("id", member_id)
      .eq("organization_id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("移除组织成员失败:", error);
    return NextResponse.json({ error: "移除组织成员失败" }, { status: 500 });
  }
}
