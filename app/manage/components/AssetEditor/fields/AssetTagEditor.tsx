"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronLeft,
  MoreHorizontal,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Tag } from "../../../types";
import { FieldLabel } from "../FieldLabel";
import {
  TAG_COLOR_PRESETS,
  DEFAULT_TAG_COLOR,
  getReadableTextColor,
} from "./tagColors";

interface AssetTagEditorProps {
  tagIds?: string[] | null;
  workspaceId: string;
  isEditing: boolean;
  onTagIdsChange: (tagIds: string[]) => void;
}

/** 彩色标签 chip(只读展示用)。 */
function TagChip({
  tag,
  onRemove,
}: {
  tag: Tag;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: tag.color,
        color: getReadableTextColor(tag.color),
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded-sm p-0.5 hover:bg-black/20"
          aria-label="remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export function AssetTagEditor({
  tagIds,
  workspaceId,
  isEditing,
  onTagIdsChange,
}: AssetTagEditorProps) {
  const { t } = useTranslation();
  const safeTagIds = tagIds ?? [];

  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "edit">("list");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);

  // 加载工作空间的所有标签
  const loadTags = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tags?workspace_id=${workspaceId}`);
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error(t("assetEditor.tags.loadFailed"), error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, t]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // 回到列表视图时重置编辑态
  const goToList = () => {
    setView("list");
    setEditingTagId(null);
  };

  // 打开某个标签的编辑视图
  const openEditView = (tag: Tag) => {
    setEditingTagId(tag.id);
    setRenameValue(tag.name);
    setView("edit");
  };

  // 创建新标签并自动选中
  const handleCreateTag = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          color: DEFAULT_TAG_COLOR,
          workspace_id: workspaceId,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setTags((prev) =>
          [...prev, data.tag].sort((a, b) => a.name.localeCompare(b.name)),
        );
        onTagIdsChange([...safeTagIds, data.tag.id]);
        setSearch("");
      } else {
        const error = await response.json();
        alert(error.error || t("assetEditor.tags.createFailed"));
      }
    } catch (error) {
      console.error(t("assetEditor.tags.createFailed"), error);
      alert(t("assetEditor.tags.createFailed"));
    } finally {
      setBusy(false);
    }
  };

  // 改名 / 改色:PATCH 单个标签
  const patchTag = async (tagId: string, body: Partial<Pick<Tag, "name" | "color">>) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data = await response.json();
        setTags((prev) =>
          prev
            .map((tag) => (tag.id === data.tag.id ? data.tag : tag))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      } else {
        const error = await response.json();
        alert(error.error || t("assetEditor.tags.updateFailed"));
      }
    } catch (error) {
      console.error(t("assetEditor.tags.updateFailed"), error);
      alert(t("assetEditor.tags.updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const commitRename = (tag: Tag) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === tag.name) {
      setRenameValue(tag.name);
      return;
    }
    patchTag(tag.id, { name: trimmed });
  };

  // 删除标签
  const handleDeleteTag = async (tagId: string) => {
    if (!confirm(t("assetEditor.tags.deleteConfirm"))) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
      if (response.ok) {
        setTags((prev) => prev.filter((tag) => tag.id !== tagId));
        onTagIdsChange(safeTagIds.filter((id) => id !== tagId));
        goToList();
      } else {
        const error = await response.json();
        alert(error.error || t("assetEditor.tags.deleteFailed"));
      }
    } catch (error) {
      console.error(t("assetEditor.tags.deleteFailed"), error);
      alert(t("assetEditor.tags.deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  // 切换某标签在当前资产上的选中状态
  const toggleSelection = (tagId: string) => {
    if (safeTagIds.includes(tagId)) {
      onTagIdsChange(safeTagIds.filter((id) => id !== tagId));
    } else {
      onTagIdsChange([...safeTagIds, tagId]);
    }
  };

  const removeSelection = (tagId: string) => {
    onTagIdsChange(safeTagIds.filter((id) => id !== tagId));
  };

  const getTag = (tagId: string) => tags.find((tag) => tag.id === tagId);
  const selectedTags = safeTagIds
    .map(getTag)
    .filter((tag): tag is Tag => Boolean(tag));

  const query = search.trim().toLowerCase();
  const filteredTags = query
    ? tags.filter((tag) => tag.name.toLowerCase().includes(query))
    : tags;
  const hasExactMatch = tags.some((tag) => tag.name.toLowerCase() === query);
  const showCreate = query.length > 0 && !hasExactMatch;

  // ===== 只读模式:仅彩色 chip,无操作 =====
  if (!isEditing) {
    return (
      <div className="space-y-2">
        <FieldLabel>{t("assetEditor.tags.title")}</FieldLabel>
        <div className="flex min-h-[36px] flex-wrap items-center gap-1.5 rounded-md bg-muted/40 p-2">
          {selectedTags.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              {t("assetEditor.tags.noTags")}
            </span>
          ) : (
            selectedTags.map((tag) => <TagChip key={tag.id} tag={tag} />)
          )}
        </div>
      </div>
    );
  }

  const editingTag = editingTagId ? getTag(editingTagId) : null;

  // ===== 编辑模式:内联 Popover =====
  return (
    <div className="space-y-2">
      <FieldLabel>{t("assetEditor.tags.title")}</FieldLabel>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setSearch("");
            goToList();
          }
        }}
      >
        <PopoverTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            className="flex min-h-[36px] cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-background p-2 transition-colors hover:border-ring/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {selectedTags.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                {t("assetEditor.tags.addPlaceholder")}
              </span>
            ) : (
              selectedTags.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  onRemove={() => removeSelection(tag.id)}
                />
              ))
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-72 p-0"
          onOpenAutoFocus={(e) => {
            if (view === "list") {
              // 让搜索框自然 autoFocus,阻止 Radix 默认聚焦行为带来的跳动
              e.preventDefault();
            }
          }}
        >
          {view === "list" ? (
            <div>
              {/* 搜索框 */}
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (showCreate) {
                        handleCreateTag(search);
                      } else if (filteredTags.length > 0) {
                        toggleSelection(filteredTags[0].id);
                      }
                    }
                  }}
                  placeholder={t("assetEditor.tags.searchPlaceholder")}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <div className="max-h-60 overflow-y-auto p-1">
                <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("assetEditor.tags.selectOrCreate")}
                </div>

                {isLoading ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    {t("assetEditor.tags.loading")}
                  </div>
                ) : (
                  <>
                    {filteredTags.map((tag) => {
                      const selected = safeTagIds.includes(tag.id);
                      return (
                        <div
                          key={tag.id}
                          className="group flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
                        >
                          <button
                            type="button"
                            onClick={() => toggleSelection(tag.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span
                              className="h-3.5 w-3.5 shrink-0 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="truncate text-sm">{tag.name}</span>
                          </button>
                          {selected && (
                            <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <button
                            type="button"
                            onClick={() => openEditView(tag)}
                            className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 hover:bg-accent-foreground/10 group-hover:opacity-100"
                            aria-label={t("assetEditor.tags.deleteTag")}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}

                    {filteredTags.length === 0 && !showCreate && (
                      <div className="px-2 py-2 text-xs text-muted-foreground">
                        {t("assetEditor.tags.noResults")}
                      </div>
                    )}

                    {showCreate && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleCreateTag(search)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                      >
                        <span className="text-muted-foreground">
                          {t("assetEditor.tags.createOption", {
                            name: search.trim(),
                          })}
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            editingTag && (
              <div>
                {/* 改名头部 */}
                <div className="flex items-center gap-1 border-b px-2 py-2">
                  <button
                    type="button"
                    onClick={goToList}
                    className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent"
                    aria-label="back"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(editingTag)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(editingTag);
                      }
                    }}
                    placeholder={t("assetEditor.tags.renamePlaceholder")}
                    className="h-8 text-sm"
                  />
                </div>

                {/* 颜色色板 */}
                <div className="p-2">
                  <div className="px-1 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("assetEditor.tags.colorSectionTitle")}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 px-1 pb-1">
                    {TAG_COLOR_PRESETS.map((preset) => {
                      const active =
                        editingTag.color.toLowerCase() ===
                        preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            patchTag(editingTag.id, { color: preset.hex })
                          }
                          title={t(`assetEditor.tags.colors.${preset.key}`)}
                          aria-label={t(`assetEditor.tags.colors.${preset.key}`)}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md border transition-transform hover:scale-105",
                            active
                              ? "ring-2 ring-ring ring-offset-1"
                              : "border-border/60",
                          )}
                          style={{ backgroundColor: preset.hex }}
                        >
                          {active && (
                            <Check
                              className="h-3.5 w-3.5"
                              style={{
                                color: getReadableTextColor(preset.hex),
                              }}
                            />
                          )}
                        </button>
                      );
                    })}

                    {/* 自定义颜色 */}
                    <label
                      title={t("assetEditor.tags.customColor")}
                      aria-label={t("assetEditor.tags.customColor")}
                      className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border/60"
                      style={{
                        background:
                          "conic-gradient(from 0deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)",
                      }}
                    >
                      <input
                        type="color"
                        value={editingTag.color}
                        disabled={busy}
                        onChange={(e) =>
                          patchTag(editingTag.id, { color: e.target.value })
                        }
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </label>
                  </div>
                </div>

                {/* 删除 */}
                <div className="border-t p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => handleDeleteTag(editingTag.id)}
                    className="w-full justify-start text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("assetEditor.tags.deleteTag")}
                  </Button>
                </div>
              </div>
            )
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
