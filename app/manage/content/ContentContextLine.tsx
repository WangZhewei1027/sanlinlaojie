"use client";

import { useTranslation } from "react-i18next";
import { Building2, FolderOpen } from "lucide-react";
import { Text } from "@/components/ui/typography";
import { ContentStatusBadge } from "./ContentStatusBadge";
import { ProjectRoleBadge } from "./ProjectRoleSelect";
import type { ContentProject, ProjectRole } from "./types";

export interface ContentContextLineProps {
  organizationName: string;
  /** Null when no single project is selected (aggregate organization view). */
  project: ContentProject | null;
  role?: ProjectRole | null;
}

/** Shows where the list lives and what the viewer may do there. */
export function ContentContextLine({ organizationName, project, role }: ContentContextLineProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Building2 className="size-3.5 shrink-0" aria-hidden />
        <span className="sr-only">{t("contentModel.context.organization")}</span>
        <Text as="span" variant="bodySm" truncate className="max-w-48" title={organizationName}>{organizationName}</Text>
      </span>
      <span aria-hidden>/</span>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <FolderOpen className="size-3.5 shrink-0" aria-hidden />
        <span className="sr-only">{t("contentModel.context.project")}</span>
        <Text as="span" variant="bodySm" tone={project ? "default" : "subdued"} fontWeight={project ? "medium" : undefined} truncate className="max-w-64" title={project?.name}>
          {project ? project.name : t("contentModel.context.noProject")}
        </Text>
      </span>
      {project && role && <ProjectRoleBadge role={role} />}
      {project?.archived && <ContentStatusBadge kind="archived" />}
    </div>
  );
}
