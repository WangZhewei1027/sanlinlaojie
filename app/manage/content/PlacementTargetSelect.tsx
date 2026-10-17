"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { useContentFormat } from "./useContentFormat";
import type { PinnedTargetOption } from "./types";

export interface PlacementTargetSelectProps {
  /** A placement pins either an asset version or a published scene revision, never a draft. */
  kind: "asset_version" | "scene_revision";
  sourceName: string;
  options: PinnedTargetOption[];
  value: string | null;
  onChange: (optionId: string) => void;
  disabled?: boolean;
}

/** Chooses the fixed version or revision a placement plays. */
export function PlacementTargetSelect({ kind, sourceName, options, value, onChange, disabled }: PlacementTargetSelectProps) {
  const { t } = useTranslation();
  const format = useContentFormat();
  const id = useId();
  const ordered = [...options].sort((a, b) => b.number - a.number);
  const latest = ordered[0];
  const selected = ordered.find((option) => option.id === value);

  if (!ordered.length) {
    return (
      <Text as="p" variant="bodySm" tone="subdued">
        {kind === "scene_revision" ? t("contentModel.placement.noRevisions") : t("contentModel.placement.noVersions")}
      </Text>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{kind === "asset_version" ? t("contentModel.placement.version") : t("contentModel.placement.revision")}</Label>
      <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full" aria-describedby={`${id}-hint`}>
          <SelectValue placeholder={t("contentModel.placement.choose")} />
        </SelectTrigger>
        <SelectContent>
          {ordered.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              <span className="tabular-nums">v{option.number}</span>
              <span className="text-muted-foreground">{format.date(option.createdAt)}</span>
              {option.id === latest.id && <span className="text-muted-foreground">· {t("contentModel.placement.latest")}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Text as="p" id={`${id}-hint`} variant="bodySm" tone={selected && selected.id !== latest.id ? "warning" : "subdued"}>
        {selected && selected.id !== latest.id
          ? t("contentModel.placement.newerAvailable", { name: sourceName, number: latest.number })
          : t("contentModel.placement.pinnedHint", { name: sourceName })}
      </Text>
    </div>
  );
}
