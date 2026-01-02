import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Save, X, Loader2 } from "lucide-react";

interface AssetEditActionsProps {
  isEditing: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function AssetEditActions({
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
}: AssetEditActionsProps) {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4 mr-1" />
          {t("assetManager.editActions.cancel")}
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              {t("assetManager.editActions.saving")}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              {t("assetManager.editActions.save")}
            </>
          )}
        </Button>
      </>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={onEdit}>
      {t("assetManager.editActions.edit")}
    </Button>
  );
}
