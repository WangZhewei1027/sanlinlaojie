"use client";

import { useTranslation } from "react-i18next";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ContentLifecycle, WorkbenchFilters, WorkbenchTypeFilter, WorkbenchView } from "./types";

/** Type filter order: scenes first (the composed works), then assets by how often they are used. */
export const WORKBENCH_TYPE_FILTERS: WorkbenchTypeFilter[] = ["all", "scene", "model", "image", "video", "audio", "text", "link", "document"];
const STATES: ContentLifecycle[] = ["active", "archived"];

export interface WorkbenchToolbarProps {
  filters: WorkbenchFilters;
  onFiltersChange: (filters: WorkbenchFilters) => void;
  view: WorkbenchView;
  onViewChange: (view: WorkbenchView) => void;
}

/** Search, lifecycle and view on one line; the type filter as a scrollable row of chips. */
export function WorkbenchToolbar({ filters, onFiltersChange, view, onViewChange }: WorkbenchToolbarProps) {
  const { t } = useTranslation();
  const set = <K extends keyof WorkbenchFilters>(key: K, value: WorkbenchFilters[K]) => onFiltersChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={filters.query}
            onChange={(event) => set("query", event.target.value)}
            placeholder={t("contentModel.workbench.search")}
            aria-label={t("contentModel.workbench.search")}
            className="ps-8 pe-8"
          />
          {filters.query && (
            <Button variant="ghost" size="icon" className="absolute end-0.5 top-0.5 size-8" onClick={() => set("query", "")} aria-label={t("contentModel.action.clearSearch")}>
              <X aria-hidden />
            </Button>
          )}
        </div>
        <div className="ms-auto flex items-center gap-2">
          <Select value={filters.state} onValueChange={(value) => set("state", value as ContentLifecycle)}>
            <SelectTrigger aria-label={t("contentModel.workbench.stateLabel")} className="w-auto min-w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATES.map((value) => <SelectItem key={value} value={value}>{t(`contentModel.filter.states.${value}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <div role="group" aria-label={t("contentModel.workbench.view.label")} className="inline-flex h-9 rounded-lg bg-muted p-[3px]">
            {([["grid", LayoutGrid], ["list", List]] as const).map(([value, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                aria-label={t(`contentModel.workbench.view.${value}`)}
                title={t(`contentModel.workbench.view.${value}`)}
                onClick={() => onViewChange(value)}
                className={cn(
                  "inline-flex w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  view === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div role="group" aria-label={t("contentModel.workbench.typeLabel")} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        {WORKBENCH_TYPE_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filters.type === value}
            onClick={() => set("type", value)}
            className={cn(
              "h-8 shrink-0 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              filters.type === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {t(`contentModel.workbench.types.${value}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function hasActiveWorkbenchFilters(filters: WorkbenchFilters) {
  return Boolean(filters.query.trim()) || filters.type !== "all" || filters.state !== "active";
}
