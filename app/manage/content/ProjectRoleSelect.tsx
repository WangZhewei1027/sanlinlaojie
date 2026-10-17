"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import type { ProjectRole } from "./types";

export const PROJECT_ROLES: ProjectRole[] = ["manager", "editor", "viewer"];

export function ProjectRoleBadge({ role }: { role: ProjectRole }) {
  const { t } = useTranslation();
  return (
    <span className={cn(badgeVariants({ variant: "secondary" }), "px-1.5 py-0 font-medium")}>
      {t(`contentModel.role.${role}`)}
    </span>
  );
}

export interface ProjectRoleSelectProps {
  value: ProjectRole;
  onChange: (role: ProjectRole) => void;
  /** Roles the caller may assign; a project manager may only assign editor or viewer. */
  allowedRoles: ProjectRole[];
  /** Organization viewers are capped at viewer whatever is selected. */
  cappedAtViewer?: boolean;
  disabled?: boolean;
  label?: string;
}

/** Project role picker with the effect of each role spelled out. */
export function ProjectRoleSelect({ value, onChange, allowedRoles, cappedAtViewer, disabled, label }: ProjectRoleSelectProps) {
  const { t } = useTranslation();
  const id = useId();
  const roles = PROJECT_ROLES.filter((role) => allowedRoles.includes(role) || role === value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label ?? t("contentModel.role.label")}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as ProjectRole)} disabled={disabled}>
        <SelectTrigger id={id} className="w-full sm:w-64" aria-describedby={`${id}-hint`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem
              key={role}
              value={role}
              disabled={!allowedRoles.includes(role) || (cappedAtViewer && role !== "viewer")}
            >
              {t(`contentModel.role.${role}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Text as="p" id={`${id}-hint`} variant="bodySm" tone="subdued">
        {cappedAtViewer ? t("contentModel.role.cappedHint") : t(`contentModel.role.${value}Hint`)}
      </Text>
    </div>
  );
}
