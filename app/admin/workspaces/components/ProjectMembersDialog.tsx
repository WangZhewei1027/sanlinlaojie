"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ProjectRole, WorkspaceMembersDto } from "@/lib/content-model/contracts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import { ContentFailureNotice, ContentNotice } from "@/app/manage/content/ContentFeedback";
import { useContentAction } from "@/app/manage/content/useContentAction";
import { isEndpointMissing, workspaceApi } from "@/app/manage/lib/content-api";
import { errorMessage, runContentAction } from "@/app/manage/lib/content-errors";
import { useIntegrationText } from "@/app/manage/lib/integration-text";
import { WORKSPACE_TEXTS } from "../workspace-texts";
import { ProjectMemberAdd } from "./ProjectMemberAdd";
import { ProjectMemberRow } from "./ProjectMemberRow";

interface ProjectMembersDialogProps {
  workspace: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Loaded =
  | { workspaceId: string; kind: "ready"; data: WorkspaceMembersDto }
  | { workspaceId: string; kind: "missing" }
  | { workspaceId: string; kind: "error"; message: string };

/**
 * Project-scoped member management. What the caller may do comes only from
 * the server's `capabilities`; org owners/admins appear as implicit managers.
 */
export function ProjectMembersDialog({ workspace, open, onOpenChange }: ProjectMembersDialogProps) {
  const tx = useIntegrationText(WORKSPACE_TEXTS);
  const workspaceId = open ? workspace?.id ?? null : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [nonce, setNonce] = useState(0);
  const { run, pending, failure, reset } = useContentAction();

  useEffect(() => {
    if (!workspaceId) return;
    const abort = new AbortController();
    workspaceApi.members(workspaceId, abort.signal)
      .then((data) => setLoaded({ workspaceId, kind: "ready", data }))
      .catch((error) => {
        if (abort.signal.aborted) return;
        setLoaded(isEndpointMissing(error)
          ? { workspaceId, kind: "missing" }
          : { workspaceId, kind: "error", message: errorMessage(error, tx) });
      });
    return () => abort.abort();
  }, [workspaceId, nonce, tx]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const current = loaded && loaded.workspaceId === workspaceId ? loaded : null;
  const data = current?.kind === "ready" ? current.data : null;
  const capabilities = data?.capabilities;
  const allowedRoles: ProjectRole[] = !capabilities?.can_manage_members
    ? []
    : capabilities.can_assign_manager ? ["manager", "editor", "viewer"] : ["editor", "viewer"];

  /** Every mutation refreshes the list, also after a 403/409 so the view matches the server. */
  const mutate = (action: () => Promise<unknown>) =>
    run(async () => {
      const result = await runContentAction(action, tx);
      reload();
      return result;
    });

  const changeOpen = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tx("contentModel.integration.members.title")}</DialogTitle>
          <DialogDescription>{tx("contentModel.integration.members.description", { name: workspace?.name ?? "" })}</DialogDescription>
        </DialogHeader>

        {!current && <MembersSkeleton />}

        {current?.kind === "missing" && (
          <ContentNotice
            title={tx("contentModel.integration.members.endpointMissing")}
            description={tx("contentModel.integration.members.endpointMissingBody")}
            action={<Button asChild variant="outline" size="sm"><Link href="/admin/members">{tx("contentModel.integration.members.openOrgMembers")}</Link></Button>}
          />
        )}

        {current?.kind === "error" && (
          <ContentNotice
            tone="critical"
            title={tx("contentModel.integration.members.loadFailed")}
            description={current.message}
            action={<Button variant="outline" size="sm" onClick={reload}>{tx("contentModel.action.retry")}</Button>}
          />
        )}

        {data && (
          <div className="space-y-4">
            {!capabilities?.can_manage_members && <ContentNotice title={tx("contentModel.integration.members.readOnly")} />}
            {failure && <ContentFailureNotice failure={failure} onRetry={() => { reset(); reload(); }} />}
            {data.members.length === 0 ? (
              <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.members.empty")}</Text>
            ) : (
              <ul className="divide-y">
                {data.members.map((member) => (
                  <ProjectMemberRow
                    key={member.user_id}
                    member={member}
                    allowedRoles={allowedRoles}
                    pending={pending}
                    tx={tx}
                    onChangeRole={(role) => mutate(() => workspaceApi.putMember(data.workspace_id, { userId: member.user_id, role }))}
                    onRemove={() => mutate(() => workspaceApi.removeMember(data.workspace_id, member.user_id))}
                  />
                ))}
              </ul>
            )}
            {capabilities?.can_manage_members && (
              <ProjectMemberAdd
                candidates={data.candidates}
                allowedRoles={allowedRoles}
                pending={pending}
                tx={tx}
                onAdd={(userId, role) => mutate(() => workspaceApi.putMember(data.workspace_id, { userId, role }))}
              />
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => changeOpen(false)}>{tx("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersSkeleton() {
  return (
    <div role="status" className="space-y-3 py-2">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
