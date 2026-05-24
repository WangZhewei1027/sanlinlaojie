import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useManageStore } from "../../../store";
import { isSpecificWorkspaceId } from "../../../constants";
import type { Asset } from "../../../types";
import { FileUploadService } from "@/lib/upload/service";
import { getAssetConfig, isFieldEditable } from "../../../config";

interface UseAssetEditorOptions {
  onUpdateAsset?: (assetId: string, updates: Partial<Asset>) => Promise<Asset>;
  onDeleteAsset?: (assetId: string) => Promise<void>;
}

export function useAssetEditor({
  onUpdateAsset,
  onDeleteAsset,
}: UseAssetEditorOptions) {
  const { t } = useTranslation();
  const selectedAssetId = useManageStore((state) => state.selectedAssetId);
  const storeWorkspaceId = useManageStore((state) => state.selectedWorkspaceId);
  const selectedWorkspaceId = isSpecificWorkspaceId(storeWorkspaceId)
    ? storeWorkspaceId
    : null;
  const assets = useManageStore((state) => state.assets);
  const setSelectedAssetId = useManageStore(
    (state) => state.setSelectedAssetId,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [checkinFile, setCheckinFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editedData, setEditedData] = useState({
    name: "",
    text_content: "",
    anchor_id: null as string | null,
    tag_ids: [] as string[],
    longitude: "",
    latitude: "",
    height: "",
    is_huge: false,
    scale_multiplier: "",
    text_color: "",
    text_size: "",
  });

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const assetConfig = useMemo(() => {
    return selectedAsset ? getAssetConfig(selectedAsset.file_type) : null;
  }, [selectedAsset]);

  useEffect(() => {
    if (selectedAsset) {
      setEditedData({
        name: selectedAsset.name || "",
        text_content: selectedAsset.text_content || "",
        tag_ids: selectedAsset.tag_ids || [],
        anchor_id: selectedAsset.anchor_id || null,
        longitude: selectedAsset.metadata.longitude?.toString() || "",
        latitude: selectedAsset.metadata.latitude?.toString() || "",
        height: selectedAsset.metadata.height?.toString() || "",
        is_huge: selectedAsset.is_huge ?? false,
        scale_multiplier:
          selectedAsset.config?.scale_multiplier?.toString() || "",
        text_color: selectedAsset.config?.text_color || "",
        text_size: selectedAsset.config?.text_size?.toString() || "",
      });
      setCheckinFile(null);
      setImageFile(null);
      setIsEditing(false);
    }
  }, [selectedAsset]);

  const handleSave = useCallback(async () => {
    if (!selectedAsset || !onUpdateAsset) return;
    setIsSaving(true);
    try {
      const updates: Partial<Asset> = {};

      if (isFieldEditable(selectedAsset.file_type, "location")) {
        updates.metadata = {
          longitude: editedData.longitude
            ? parseFloat(editedData.longitude)
            : undefined,
          latitude: editedData.latitude
            ? parseFloat(editedData.latitude)
            : undefined,
          height: editedData.height ? parseFloat(editedData.height) : undefined,
        };
      }

      if (assetConfig?.previewType === "image" && imageFile) {
        const uploadService = new FileUploadService();
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const processed = await uploadService.processFile(imageFile);
          updates.file_url = await uploadService.uploadToStorage(
            processed.file,
            user.id,
          );
        }
      }

      if (selectedAsset.file_type === "shop" && checkinFile) {
        const uploadService = new FileUploadService();
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const processed = await uploadService.processFile(checkinFile);
          const checkinUrl = await uploadService.uploadToStorage(
            processed.file,
            user.id,
          );
          updates.metadata = { ...updates.metadata, checkin_url: checkinUrl };
        }
      }

      if (isFieldEditable(selectedAsset.file_type, "name"))
        updates.name = editedData.name;
      if (isFieldEditable(selectedAsset.file_type, "text_content"))
        updates.text_content = editedData.text_content;
      if (isFieldEditable(selectedAsset.file_type, "anchor_id"))
        updates.anchor_id = editedData.anchor_id;
      if (isFieldEditable(selectedAsset.file_type, "tag_ids"))
        updates.tag_ids = editedData.tag_ids;
      if (isFieldEditable(selectedAsset.file_type, "is_huge"))
        updates.is_huge = editedData.is_huge;

      if (isFieldEditable(selectedAsset.file_type, "scale_multiplier")) {
        const parsed = parseFloat(editedData.scale_multiplier);
        updates.config = {
          ...selectedAsset.config,
          scale_multiplier:
            editedData.scale_multiplier === "" || isNaN(parsed)
              ? undefined
              : parsed,
        };
      }

      if (isFieldEditable(selectedAsset.file_type, "text_color")) {
        const parsedSize = parseFloat(editedData.text_size);
        updates.config = {
          ...selectedAsset.config,
          ...updates.config,
          text_color:
            editedData.text_color === "" ? undefined : editedData.text_color,
          text_size:
            editedData.text_size === "" || isNaN(parsedSize)
              ? undefined
              : parsedSize,
        };
      }

      await onUpdateAsset(selectedAsset.id, updates);
      setIsEditing(false);
    } catch (error) {
      console.error("保存失败:", error);
      alert(t("assetEditor.saveFailed"));
    } finally {
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedAsset,
    editedData,
    imageFile,
    checkinFile,
    assetConfig,
    onUpdateAsset,
  ]);

  const handleCancel = useCallback(() => {
    if (selectedAsset) {
      setEditedData({
        tag_ids: selectedAsset.tag_ids || [],
        name: selectedAsset.name || "",
        text_content: selectedAsset.text_content || "",
        anchor_id: selectedAsset.anchor_id || null,
        longitude: selectedAsset.metadata.longitude?.toString() || "",
        latitude: selectedAsset.metadata.latitude?.toString() || "",
        height: selectedAsset.metadata.height?.toString() || "",
        is_huge: selectedAsset.is_huge ?? false,
        scale_multiplier:
          selectedAsset.config?.scale_multiplier?.toString() || "",
        text_color: selectedAsset.config?.text_color || "",
        text_size: selectedAsset.config?.text_size?.toString() || "",
      });
      setCheckinFile(null);
      setImageFile(null);
    }
    setIsEditing(false);
  }, [selectedAsset]);

  const handleDelete = useCallback(async () => {
    if (!selectedAsset || !onDeleteAsset) return;
    setIsDeleting(true);
    try {
      await onDeleteAsset(selectedAsset.id);
      setShowDeleteDialog(false);
      setSelectedAssetId(null);
    } catch (error) {
      console.error("删除失败:", error);
      alert(t("assetEditor.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAsset, onDeleteAsset, setSelectedAssetId]);

  const handleClose = useCallback(() => {
    setSelectedAssetId(null);
    setIsEditing(false);
  }, [setSelectedAssetId]);

  return {
    selectedAsset,
    assetConfig,
    selectedWorkspaceId,
    editedData,
    setEditedData,
    isEditing,
    setIsEditing,
    isSaving,
    isDeleting,
    showDeleteDialog,
    setShowDeleteDialog,
    checkinFile,
    setCheckinFile,
    imageFile,
    setImageFile,
    handleSave,
    handleCancel,
    handleDelete,
    handleClose,
  };
}
