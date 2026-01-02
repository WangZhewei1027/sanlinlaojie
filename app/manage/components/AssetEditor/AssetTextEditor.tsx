import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";

interface AssetTextEditorProps {
  textContent?: string | null;
  isEditing: boolean;
  editedText: string;
  onTextChange: (text: string) => void;
  label?: string;
  placeholder?: string;
}

export function AssetTextEditor({
  textContent,
  isEditing,
  editedText,
  onTextChange,
  label,
  placeholder,
}: AssetTextEditorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label || t("assetEditor.fields.textContent")}
      </label>
      {isEditing ? (
        <Textarea
          value={editedText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={
            placeholder || t("assetEditor.fields.textContentPlaceholder")
          }
          rows={3}
          className="text-sm"
        />
      ) : (
        <p className="text-sm p-3 bg-background rounded-md">
          {textContent || t("assetEditor.fields.noContent")}
        </p>
      )}
    </div>
  );
}
