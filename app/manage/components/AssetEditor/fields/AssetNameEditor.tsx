import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "../FieldLabel";

interface AssetNameEditorProps {
  name?: string | null;
  isEditing: boolean;
  editedName: string;
  onNameChange: (name: string) => void;
  label?: string;
  placeholder?: string;
}

export function AssetNameEditor({
  name,
  isEditing,
  editedName,
  onNameChange,
  label,
  placeholder,
}: AssetNameEditorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <FieldLabel>{label || t("assetEditor.fields.name")}</FieldLabel>
      {isEditing ? (
        <Input
          value={editedName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={placeholder || t("assetEditor.fields.namePlaceholder")}
          className="text-sm"
        />
      ) : (
        <p className="text-sm p-3 bg-muted/40 rounded-md">
          {name || t("assetEditor.unnamed")}
        </p>
      )}
    </div>
  );
}
