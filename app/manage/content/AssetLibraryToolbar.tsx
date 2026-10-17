"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Search, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AssetLibraryFilters, AssetLibraryScope, AssetOrigin, ContentAssetType, ContentLifecycle } from "./types";

export const ASSET_TYPES: ContentAssetType[] = ["model", "image", "video", "audio", "text", "link", "document"];
const STATES: Array<ContentLifecycle | "all"> = ["active", "archived", "all"];
const ORIGINS: Array<AssetOrigin | "all"> = ["all", "team_upload", "public_submission", "legacy"];

export interface AssetLibraryToolbarProps {
  scope: AssetLibraryScope;
  onScopeChange: (scope: AssetLibraryScope) => void;
  filters: AssetLibraryFilters;
  onFiltersChange: (filters: AssetLibraryFilters) => void;
  /** Uploading needs a real, writable project; pass a reason when it is unavailable. */
  canUpload: boolean;
  uploadUnavailableReason?: string;
  onUpload: () => void;
}

export function AssetLibraryToolbar({
  scope,
  onScopeChange,
  filters,
  onFiltersChange,
  canUpload,
  uploadUnavailableReason,
  onUpload,
}: AssetLibraryToolbarProps) {
  const { t } = useTranslation();
  const reasonId = useId();
  const showReason = !canUpload && Boolean(uploadUnavailableReason);
  const set = <K extends keyof AssetLibraryFilters>(key: K, value: AssetLibraryFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t("contentModel.library.scopeLabel")} className="inline-flex h-9 rounded-lg bg-muted p-[3px]">
          {(["project", "organization"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => onScopeChange(value)}
              className={cn(
                "rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                scope === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`contentModel.library.scope.${value}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {showReason && (
            <span id={reasonId} className="order-last basis-full text-end text-xs text-muted-foreground sm:order-none sm:basis-auto">
              {uploadUnavailableReason}
            </span>
          )}
          <Button onClick={onUpload} disabled={!canUpload} aria-describedby={showReason ? reasonId : undefined}>
            <Upload aria-hidden />
            {t("contentModel.library.upload")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative md:max-w-sm md:flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={filters.query}
            onChange={(event) => set("query", event.target.value)}
            placeholder={t("contentModel.library.searchPlaceholder")}
            aria-label={t("contentModel.library.searchPlaceholder")}
            className="ps-8 pe-8"
          />
          {filters.query && (
            <Button variant="ghost" size="icon" className="absolute end-0.5 top-0.5 size-8" onClick={() => set("query", "")} aria-label={t("contentModel.action.clearSearch")}>
              <X aria-hidden />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 md:flex">
          <FilterSelect label={t("contentModel.filter.type")} value={filters.type} onChange={(value) => set("type", value as AssetLibraryFilters["type"])}
            options={["all", ...ASSET_TYPES].map((value) => ({ value, label: value === "all" ? t("contentModel.filter.allTypes") : t(`fileTypes.${value}`) }))} />
          <FilterSelect label={t("contentModel.filter.state")} value={filters.state} onChange={(value) => set("state", value as AssetLibraryFilters["state"])}
            options={STATES.map((value) => ({ value, label: t(`contentModel.filter.states.${value}`) }))} />
          <FilterSelect label={t("contentModel.filter.origin")} value={filters.origin} onChange={(value) => set("origin", value as AssetLibraryFilters["origin"])}
            options={ORIGINS.map((value) => ({ value, label: t(`contentModel.filter.origins.${value}`) }))} />
        </div>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full min-w-0 md:w-auto md:min-w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function hasActiveAssetFilters(filters: AssetLibraryFilters) {
  return Boolean(filters.query) || filters.type !== "all" || filters.state !== "active" || filters.origin !== "all";
}
