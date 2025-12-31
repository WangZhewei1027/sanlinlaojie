"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Edit2, Trash2, Loader2 } from "lucide-react";
import type { Tag } from "../../types";

interface AssetTagEditorProps {
  tagIds?: string[];
  workspaceId: string;
  isEditing: boolean;
  onTagIdsChange: (tagIds: string[]) => void;
}

export function AssetTagEditor({
  tagIds = [],
  workspaceId,
  isEditing,
  onTagIdsChange,
}: AssetTagEditorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#808080");
  const [selectedTagId, setSelectedTagId] = useState<string>("");
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
        // 自动添加到选中的标签
        onTagIdsChange([...tagIds, data.tag.id]);
      } else {
        const error = await response.json();
        alert(error.error || "创建标签失败");
      }
    } catch (error) {
      console.error("创建标签失败:", error);
      alert("创建标签失败");
    } finally {
      setIsSaving(false);
    }
  };

  // 更新标签
  const handleUpdateTag = async () => {
    if (!editingTag || !newTagName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/tags/${editingTag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTags(tags.map((t) => (t.id === data.tag.id ? data.tag : t)));
        setShowEditDialog(false);
        setEditingTag(null);
        setNewTagName("");
        setNewTagColor("#808080");
      } else {
        const error = await response.json();
        alert(error.error || "更新标签失败");
      }
    } catch (error) {
      console.error("更新标签失败:", error);
      alert("更新标签失败");
    } finally {
      setIsSaving(false);
    }
  };

  // 删除标签
  const handleDeleteTag = async (tagId: string) => {
    if (!confirm("确定要删除这个标签吗？")) return;

    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTags(tags.filter((t) => t.id !== tagId));
        // 从资产的标签中移除
        onTagIdsChange(tagIds.filter((id) => id !== tagId));
      } else {
        const error = await response.json();
        alert(error.error || "删除标签失败");
      }
    } catch (error) {
      console.error("删除标签失败:", error);
      alert("删除标签失败");
    }
  };

  // 打开编辑对话框
  const openEditDialog = (tag: Tag) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
    setShowEditDialog(true);
  };

  // 添加标签到资产
  const handleAddTag = () => {
    if (!selectedTagId || tagIds.includes(selectedTagId)) return;
    onTagIdsChange([...tagIds, selectedTagId]);
    setSelectedTagId("");
  };

  // 从资产移除标签
  const handleRemoveTag = (tagId: string) => {
    onTagIdsChange(tagIds.filter((id) => id !== tagId));
  };

  // 获取标签对象
  const getTag = (tagId: string) => tags.find((t) => t.id === tagId);

  // 可以添加的标签（不在当前资产的标签中）
  const availableTags = tags.filter((t) => !tagIds.includes(t.id));

  return (
    <>
      {/* 创建标签对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新标签</DialogTitle>
            <DialogDescription>为这个工作空间创建一个新标签</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">标签名称</Label>
              <Input
                id="tag-name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="输入标签名称"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateTag();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-color">标签颜色</Label>
              <div className="flex items-center gap-2">
                <input
                  id="tag-color"
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-10 w-20 rounded border border-input cursor-pointer"
                />
                <Badge style={{ backgroundColor: newTagColor }}>
                  {newTagName || "预览"}
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
              取消
            </Button>
            <Button
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  创建中...
                </>
              ) : (
                "创建"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑标签对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑标签</DialogTitle>
            <DialogDescription>修改标签的名称和颜色</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tag-name">标签名称</Label>
              <Input
                id="edit-tag-name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="输入标签名称"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUpdateTag();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tag-color">标签颜色</Label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-tag-color"
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-10 w-20 rounded border border-input cursor-pointer"
                />
                <Badge style={{ backgroundColor: newTagColor }}>
                  {newTagName || "预览"}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => editingTag && handleDeleteTag(editingTag.id)}
              className="text-destructive hover:text-destructive mr-auto"
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除标签
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  setEditingTag(null);
                  setNewTagName("");
                  setNewTagColor("#808080");
                }}
                disabled={isSaving}
              >
                取消
              </Button>
              <Button
                onClick={handleUpdateTag}
                disabled={!newTagName.trim() || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 标签编辑器主界面 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">标签</label>
          {isEditing && (
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
              新建标签
            </Button>
          )}
        </div>

        {/* 已选中的标签 */}
        <div className="flex flex-wrap gap-2 min-h-[32px] p-2 bg-background rounded-md border">
          {isLoading ? (
            <span className="text-xs text-muted-foreground">加载中...</span>
          ) : tagIds.length === 0 ? (
            <span className="text-xs text-muted-foreground">无标签</span>
          ) : (
            tagIds.map((tagId) => {
              const tag = getTag(tagId);
              if (!tag) return null;
              return (
                <Badge
                  key={tagId}
                  style={{ backgroundColor: tag.color }}
                  className="gap-1 pr-1"
                >
                  {tag.name}
                  {isEditing && (
                    <>
                      <button
                        onClick={() => openEditDialog(tag)}
                        className="ml-1 hover:bg-black/20 rounded-sm p-0.5"
                        title="编辑标签"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleRemoveTag(tagId)}
                        className="hover:bg-black/20 rounded-sm p-0.5"
                        title="移除标签"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </Badge>
              );
            })
          )}
        </div>

        {/* 添加标签选择器 */}
        {isEditing && availableTags.length > 0 && (
          <div className="flex gap-2">
            <Select value={selectedTagId} onValueChange={setSelectedTagId}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="选择标签" />
              </SelectTrigger>
              <SelectContent>
                {availableTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleAddTag}
              disabled={!selectedTagId}
              className="h-8"
            >
              添加
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
