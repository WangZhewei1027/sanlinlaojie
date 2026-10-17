"use client";

import { useState } from "react";
import type { ProjectRole, WorkspaceMemberDto } from "@/lib/content-model/contracts";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ProjectRoleBadge, ProjectRoleSelect } from "@/app/manage/content/ProjectRoleSelect";
import type { IntegrationT } from "@/app/manage/lib/integration-text";

interface ProjectMemberRowProps {
  member: WorkspaceMemberDto;
  /** Roles the caller may assign (server capabilities). Empty = read-only. */
  allowedRoles: ProjectRole[];
  pending: boolean;
  onChangeRole: (role: ProjectRole) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
  tx: IntegrationT;
}

export function memberDisplayName(member: { name: string | null; email: string | null }, tx: IntegrationT) {
  return member.name || member.email || tx("contentModel.integration.members.unnamed");
}

/** One project member: identity, org role, effective project role and edit/remove. */
export function ProjectMemberRow({ member, allowedRoles, pending, onChangeRole, onRemove, tx }: ProjectMemberRowProps) {
  const [mode, setMode] = useState<"view" | "edit" | "remove">("view");
  const [role, setRole] = useState<ProjectRole>(member.effective_role);
  const name = memberDisplayName(member, tx);
  const orgRole = tx(`admin.organization.roles.${member.org_role}`);
  const cappedAtViewer = member.org_role === "viewer";
  // Implicit owner/admin access is not an assignment; a manager the caller may not grant is not editable either.
  const editable = !member.implicit && allowedRoles.length > 0 && allowedRoles.includes(member.effective_role);

  const save = async () => {
    if (role === member.effective_role || (await onChangeRole(role))) setMode("view");
  };
  const remove = async () => {
    if (await onRemove()) setMode("view");
  };

  return (
    <li className="space-y-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        {/* Wraps the actions below a long name/email instead of squeezing either. */}
        <div className="min-w-0 flex-1 basis-48">
          <Text as="p" variant="bodySm" fontWeight="medium" truncate title={name}>{name}</Text>
          {member.name && member.email && <Text as="p" variant="bodyXs" tone="subdued" truncate title={member.email}>{member.email}</Text>}
          <Text as="p" variant="bodyXs" tone="subdued">
            {member.implicit
              ? tx("contentModel.integration.members.implicit", { role: orgRole })
              : tx("contentModel.integration.members.orgRole", { role: orgRole })}
          </Text>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ProjectRoleBadge role={member.effective_role} />
          {editable && mode === "view" && (
            <>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => { setRole(member.effective_role); setMode("edit"); }}>
                {tx("contentModel.integration.members.changeRole")}
              </Button>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => setMode("remove")}>
                {tx("contentModel.integration.members.remove")}
              </Button>
            </>
          )}
        </div>
      </div>

      {mode === "edit" && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
          <div className="min-w-0 flex-1 basis-56">
            <ProjectRoleSelect value={role} onChange={setRole} allowedRoles={allowedRoles} cappedAtViewer={cappedAtViewer} disabled={pending} />
          </div>
          <div className="flex gap-2 sm:mb-6">
            <Button variant="outline" size="sm" disabled={pending} onClick={() => setMode("view")}>{tx("common.cancel")}</Button>
            <Button variant="secondary" size="sm" disabled={pending || (cappedAtViewer && role !== "viewer")} onClick={save}>
              {tx("contentModel.integration.members.save")}
            </Button>
          </div>
        </div>
      )}

      {mode === "remove" && (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <Text as="p" variant="bodySm">{tx("contentModel.integration.members.removeConfirm", { name })}</Text>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" disabled={pending} onClick={() => setMode("view")}>{tx("common.cancel")}</Button>
            <Button variant="secondary" size="sm" disabled={pending} onClick={remove}>
              {tx("contentModel.integration.members.removeConfirmAction")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
