"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, X, Loader2, Tag } from "lucide-react";

interface TagData {
  id: string;
  name: string;
  color: string;
  workspace_id: string;
}

interface TagSelectorProps {
  workspaceId: string;
  selectedTagIds: string[];
  onTagIdsChange: (tagIds: string[]) => void;
}

export function TagSelector({
  workspaceId,
  selectedTagIds,
  onTagIdsChange,
}: TagSelectorProps) {
  const { t } = useTranslation();
  const [tags, setTags] = useState<TagData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#808080");
  const [isSaving, setIsSaving] = useState(false);

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
      console.error("加载标签失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // 创建新标签
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
          workspace_id: workspaceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTags([...tags, data.tag]);
        setShowCreateDialog(false);
        setNewTagName("");
        setNewTagColor("#808080");
        // 自动选中新创建的标签
        onTagIdsChange([...selectedTagIds, data.tag.id]);
      } else {
        const error = await response.json();
        alert(error.error || t("onsite.tags.createFailed"));
      }
    } catch (error) {
      console.error("创建标签失败:", error);
      alert(t("onsite.tags.createFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  // 切换标签选中状态
  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagIdsChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onTagIdsChange([...selectedTagIds, tagId]);
    }
  };

  // 获取标签对象
  const getTag = (tagId: string) => tags.find((t) => t.id === tagId);

  return (
    <>
      {/* 创建标签对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("onsite.tags.createTitle")}</DialogTitle>
            <DialogDescription>
              {t("onsite.tags.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">{t("onsite.tags.tagName")}</Label>
              <Input
                id="tag-name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder={t("onsite.tags.tagNamePlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateTag();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-color">{t("onsite.tags.tagColor")}</Label>
              <div className="flex items-center gap-2">
                <input
                  id="tag-color"
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-10 w-20 rounded border border-input cursor-pointer"
                />
                <Badge style={{ backgroundColor: newTagColor }}>
                  {newTagName || t("onsite.tags.preview")}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setNewTagName("");
                setNewTagColor("#808080");
              }}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {t("onsite.tags.creating")}
                </>
              ) : (
                t("common.create")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 标签选择器 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" />
              {t("onsite.tags.title")}
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNewTagName("");
                setNewTagColor("#808080");
                setShowCreateDialog(true);
              }}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              {t("onsite.tags.createNew")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("onsite.tags.loading")}
            </div>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("onsite.tags.noTagsAvailable")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <Badge
                    key={tag.id}
                    style={{
                      backgroundColor: isSelected ? tag.color : "transparent",
                      borderColor: tag.color,
                      color: isSelected ? "white" : tag.color,
                    }}
                    className="cursor-pointer border-2 transition-all hover:opacity-80"
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                    {isSelected && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* 已选中的标签提示 */}
          {selectedTagIds.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("onsite.tags.selectedCount", { count: selectedTagIds.length })}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
