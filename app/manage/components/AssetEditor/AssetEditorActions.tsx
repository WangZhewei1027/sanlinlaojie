"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Trash2, Edit2, Save, X, Loader2 } from "lucide-react";

interface AssetEditorActionsProps {
  isEditing: boolean;
  isSaving: boolean;
  canDelete: boolean;
  onEditStart: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDeleteRequest: () => void;
}

export function AssetEditorActions({
  isEditing,
  isSaving,
  canDelete,
  onEditStart,
  onSave,
  onCancel,
  onDeleteRequest,
}: AssetEditorActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between gap-2">
      {canDelete && !isEditing && (
        <Button
          size="sm"
          variant="outline"
          onClick={onDeleteRequest}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {t("common.delete")}
        </Button>
      )}
      <div className="flex gap-2 ml-auto">
        {!isEditing ? (
          <Button size="sm" onClick={onEditStart}>
            <Edit2 className="h-4 w-4 mr-1" />
            {t("common.edit")}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-1" />
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {t("assetEditor.saving")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  {t("common.save")}
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
