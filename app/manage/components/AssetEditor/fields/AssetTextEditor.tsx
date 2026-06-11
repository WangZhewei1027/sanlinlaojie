import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { FieldLabel } from "../FieldLabel";

interface AssetTextEditorProps {
  textContent?: string | null;
  isEditing: boolean;
  editedText: string;
  onTextChange: (text: string) => void;
  label?: string;
  placeholder?: string;
  /** i18n key shown when there is no content (defaults to "no content") */
  emptyLabel?: string;
  rows?: number;
}

export function AssetTextEditor({
  textContent,
  isEditing,
  editedText,
  onTextChange,
  label,
  placeholder,
  emptyLabel,
  rows = 3,
}: AssetTextEditorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <FieldLabel>{label || t("assetEditor.fields.textContent")}</FieldLabel>
      {isEditing ? (
        <Textarea
          value={editedText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={
            placeholder || t("assetEditor.fields.textContentPlaceholder")
          }
          rows={rows}
          className="text-sm"
        />
      ) : (
        <p className="text-sm p-3 bg-muted/40 rounded-md">
          {textContent || t(emptyLabel || "assetEditor.fields.noContent")}
        </p>
      )}
    </div>
  );
}
