"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FileJson, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SceneListFilters } from "./types";

const STATUS_OPTIONS: Array<SceneListFilters["status"]> = ["current", "unpublished", "published", "changed", "archived"];

export interface SceneListToolbarProps {
  filters: SceneListFilters;
  onFiltersChange: (filters: SceneListFilters) => void;
  canCreate: boolean;
  createUnavailableReason?: string;
  onCreate: () => void;
  onImport?: () => void;
}

export function SceneListToolbar({ filters, onFiltersChange, canCreate, createUnavailableReason, onCreate, onImport }: SceneListToolbarProps) {
  const { t } = useTranslation();
  const reasonId = useId();
  const showReason = !canCreate && Boolean(createUnavailableReason);

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row">
        <div className="relative sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={filters.query}
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
            placeholder={t("contentModel.scene.searchPlaceholder")}
            aria-label={t("contentModel.scene.searchPlaceholder")}
            className="ps-8 pe-8"
          />
          {filters.query && (
            <Button variant="ghost" size="icon" className="absolute end-0.5 top-0.5 size-8" onClick={() => onFiltersChange({ ...filters, query: "" })} aria-label={t("contentModel.action.clearSearch")}>
              <X aria-hidden />
            </Button>
          )}
        </div>
        <Select value={filters.status} onValueChange={(status) => onFiltersChange({ ...filters, status: status as SceneListFilters["status"] })}>
          <SelectTrigger aria-label={t("contentModel.filter.state")} className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>{t(`contentModel.scene.filter.${status}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {showReason && (
          <span id={reasonId} className="order-last basis-full text-end text-xs text-muted-foreground sm:order-none sm:basis-auto">
            {createUnavailableReason}
          </span>
        )}
        {onImport && (
          <Button variant="outline" onClick={onImport}>
            <FileJson aria-hidden />
            {t("contentModel.scene.import")}
          </Button>
        )}
        <Button onClick={onCreate} disabled={!canCreate} aria-describedby={showReason ? reasonId : undefined}>
          <Plus aria-hidden />
          {t("contentModel.scene.create")}
        </Button>
      </div>
    </div>
  );
}
