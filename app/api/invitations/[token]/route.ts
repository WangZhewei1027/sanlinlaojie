import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOrgId } from "@/lib/permissions.server";
import { logError } from "@/lib/log-error";

interface InvitationRow {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  role: string;
  revoked: boolean;
  expires_at: string | null;
  use_count: number;
}

function invalidReason(inv: InvitationRow | null): string | null {
  if (!inv) return "邀请无效";
  if (inv.revoked) return "邀请已撤销";
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now())
    return "邀请已过期";
  return null;
}

// 预览邀请（不写库，供 /invite 页展示；无需登录）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const supabase = await createClient();
    const { token } = await params;

    const { data: inv } = await supabase
      .from("organization_invitation")
      .select(
        "id, organization_id, workspace_id, role, revoked, expires_at, use_count, organization(name)",
      )
      .eq("token", token)
      .single();

    const reason = invalidReason(inv as InvitationRow | null);

    return NextResponse.json({
      data: {
        valid: reason === null,
        reason,
        role: inv?.role ?? null,
        organization_name:
          (inv?.organization as { name?: string } | null)?.name ?? null,
        has_workspace: Boolean(inv?.workspace_id),
      },
    });
  } catch (error) {
    console.error("预览邀请失败:", error);
    return NextResponse.json({ error: "预览邀请失败" }, { status: 500 });
  }
}

// 接受邀请（自动同意）：先入 org（强制），再按需分配 workspace
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const supabase = await createClient();
  const { token } = await params;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { data: inv } = await supabase
      .from("organization_invitation")
      .select(
        "id, organization_id, workspace_id, role, revoked, expires_at, use_count",
      )
      .eq("token", token)
      .single();

    const invitation = inv as InvitationRow | null;
    const reason = invalidReason(invitation);
    if (reason || !invitation) {
      return NextResponse.json({ error: reason ?? "邀请无效" }, { status: 400 });
    }

    // ① org 强制：先写成员行（幂等）
    const { error: memberError } = await supabase
      .from("organization_member")
      .upsert(
        {
          organization_id: invitation.organization_id,
          user_id: user.id,
          role: invitation.role,
        },
        { onConflict: "organization_id,user_id", ignoreDuplicates: true },
      );

    if (memberError) throw memberError;

    // ② workspace 可选：复核归属后分配（幂等）
    if (invitation.workspace_id) {
      const wsOrg = await getWorkspaceOrgId(supabase, invitation.workspace_id);
      if (wsOrg === invitation.organization_id) {
        const { error: assignError } = await supabase
          .from("workspace_assignment")
          .upsert(
            { user_id: user.id, workspace_id: invitation.workspace_id },
            { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
          );
        if (assignError) throw assignError;
      }
    }

    await supabase
      .from("organization_invitation")
      .update({ use_count: invitation.use_count + 1 })
      .eq("id", invitation.id);

    return NextResponse.json({
      data: {
        organization_id: invitation.organization_id,
        workspace_id: invitation.workspace_id,
      },
    });
  } catch (error) {
    console.error("接受邀请失败:", error);
    await logError(supabase, {
      method: "POST",
      path: `/api/invitations/${token}`,
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "接受邀请失败" }, { status: 500 });
  }
}
