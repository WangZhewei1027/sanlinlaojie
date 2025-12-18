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
          取消
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              保存
            </>
          )}
        </Button>
      </>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={onEdit}>
      编辑
    </Button>
  );
}
