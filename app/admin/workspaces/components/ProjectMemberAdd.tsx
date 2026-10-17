"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import type { ProjectRole, WorkspaceMembersDto } from "@/lib/content-model/contracts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { ProjectRoleSelect } from "@/app/manage/content/ProjectRoleSelect";
import type { IntegrationT } from "@/app/manage/lib/integration-text";
import { memberDisplayName } from "./ProjectMemberRow";

type Candidate = WorkspaceMembersDto["candidates"][number];

interface ProjectMemberAddProps {
  candidates: Candidate[];
  allowedRoles: ProjectRole[];
  pending: boolean;
  onAdd: (userId: string, role: ProjectRole) => Promise<boolean>;
  tx: IntegrationT;
}

function defaultRole(candidate: Candidate | undefined, allowedRoles: ProjectRole[]): ProjectRole {
  if (candidate?.org_role === "viewer" || !allowedRoles.includes("editor")) return "viewer";
  return "editor";
}

/** Grants project access to an existing organization member (no invitations here). */
export function ProjectMemberAdd({ candidates, allowedRoles, pending, onAdd, tx }: ProjectMemberAddProps) {
  const id = useId();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ProjectRole>("editor");
  const candidate = candidates.find((item) => item.user_id === userId);
  const cappedAtViewer = candidate?.org_role === "viewer";

  const select = (next: string) => {
    setUserId(next);
    setRole(defaultRole(candidates.find((item) => item.user_id === next), allowedRoles));
  };
  const add = async () => {
    if (!candidate) return;
    if (await onAdd(candidate.user_id, cappedAtViewer ? "viewer" : role)) {
      setUserId("");
      setRole("editor");
    }
  };
  const inviteLink = (
    <Link href="/admin/members" className="text-primary underline-offset-4 hover:underline">
      {tx("contentModel.integration.members.add.inviteLink")}
    </Link>
  );

  return (
    <section className="space-y-3 border-t pt-4" aria-labelledby={`${id}-title`}>
      <Text as="h3" id={`${id}-title`} variant="bodySm" fontWeight="semibold">
        {tx("contentModel.integration.members.add.title")}
      </Text>
      {candidates.length === 0 ? (
        <Text as="p" variant="bodySm" tone="subdued">
          {tx("contentModel.integration.members.add.noCandidates")} {inviteLink}
        </Text>
      ) : (
        <>
          {/* One column on phones; member and role side by side once the dialog is wide enough. */}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,16rem)] sm:items-start">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`${id}-member`}>{tx("contentModel.integration.members.add.member")}</Label>
              <Select value={userId} onValueChange={select} disabled={pending}>
                <SelectTrigger id={`${id}-member`} className="w-full">
                  <SelectValue placeholder={tx("contentModel.integration.members.add.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((item) => (
                    <SelectItem key={item.user_id} value={item.user_id}>
                      {memberDisplayName(item, tx)}
                      {item.name && item.email ? ` · ${item.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <ProjectRoleSelect
                value={cappedAtViewer ? "viewer" : role}
                onChange={setRole}
                allowedRoles={allowedRoles}
                cappedAtViewer={cappedAtViewer}
                disabled={pending || !candidate}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Text as="p" variant="bodySm" tone="subdued" className="min-w-0 max-w-md">
              {tx("contentModel.integration.members.add.hint")} {inviteLink}
            </Text>
            <Button onClick={add} disabled={pending || !candidate} className="self-start sm:self-auto">
              <UserPlus aria-hidden />
              {tx("contentModel.integration.members.add.submit")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
