"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Calendar, Edit, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { ContentFailureNotice } from "@/app/manage/content/ContentFeedback";
import { useContentAction } from "@/app/manage/content/useContentAction";
import { workspaceApi } from "@/app/manage/lib/content-api";
import { useWorkspaceInfo } from "@/app/manage/lib/content-context";
import { runContentAction } from "@/app/manage/lib/content-errors";
import type { IntegrationT } from "@/app/manage/lib/integration-text";
import { ArchiveWorkspaceDialog } from "./ArchiveWorkspaceDialog";

export interface WorkspaceCardData {
  id: string;
  name: string;
  description: string | null;
  create_date: string | null;
  organization_id?: string;
}

interface WorkspaceCardProps {
  workspace: WorkspaceCardData;
  /** v2: archive/restore replaces delete; unknown (state loading/failed): neither. */
  lifecycle: "legacy" | "v2" | "unknown";
  canEdit: boolean;
  canDelete: boolean;
  createdAtLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  onMembers: () => void;
  tx: IntegrationT;
}

export function WorkspaceCard({ workspace, lifecycle, canEdit, canDelete, createdAtLabel, onEdit, onDelete, onMembers, tx }: WorkspaceCardProps) {
  // Capabilities are fetched only for v2 organizations; legacy keeps the org-role gated delete.
  const contentModelV2 = lifecycle === "v2";
  const info = useWorkspaceInfo(contentModelV2 ? workspace.id : null);
  const archived = Boolean(info.workspace?.archived_at);
  const canArchive = contentModelV2 && info.workspace?.capabilities.can_archive === true;
  const [archiveOpen, setArchiveOpen] = useState(false);
  const archiveAction = useContentAction();
  const restoreAction = useContentAction();

  const archive = async () => {
    const ok = await archiveAction.run(() => runContentAction(() => workspaceApi.archive(workspace.id), tx, info.refresh));
    if (ok) setArchiveOpen(false);
  };
  const restore = () => restoreAction.run(() => runContentAction(() => workspaceApi.restore(workspace.id), tx, info.refresh));

  return (
    <Card className="p-6 transition-shadow hover:shadow-md">
      <div className="flex h-full flex-col">
        <div className="mb-4 min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Text as="h3" variant="headingMd" truncate>{workspace.name}</Text>
            {archived && <Badge variant="secondary" className="shrink-0">{tx("contentModel.integration.members.archive.badge")}</Badge>}
          </div>
          {workspace.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{workspace.description}</p>
          )}
        </div>

        {workspace.create_date && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{createdAtLabel} {new Date(workspace.create_date).toLocaleDateString()}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button variant="outline" size="sm" onClick={onMembers} className="flex-1">
            <Users aria-hidden />
            {tx("contentModel.integration.members.action")}
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
              <Edit aria-hidden />
              {tx("common.edit")}
            </Button>
          )}
          {canArchive && !archived && (
            <Button variant="outline" size="sm" onClick={() => { archiveAction.reset(); setArchiveOpen(true); }} className="flex-1">
              <Archive aria-hidden />
              {tx("contentModel.integration.members.archive.action")}
            </Button>
          )}
          {canArchive && archived && (
            <Button variant="outline" size="sm" onClick={restore} disabled={restoreAction.pending} className="flex-1">
              <ArchiveRestore aria-hidden />
              {tx("contentModel.integration.members.archive.restore")}
            </Button>
          )}
          {lifecycle === "legacy" && canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 aria-hidden />
              {tx("common.delete")}
            </Button>
          )}
        </div>
        {restoreAction.failure && <ContentFailureNotice failure={restoreAction.failure} className="mt-3" />}
      </div>

      <ArchiveWorkspaceDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        name={workspace.name}
        pending={archiveAction.pending}
        failure={archiveAction.failure}
        onConfirm={archive}
        tx={tx}
      />
    </Card>
  );
}
