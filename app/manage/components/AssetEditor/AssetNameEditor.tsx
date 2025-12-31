import { Input } from "@/components/ui/input";

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
  label = "名称",
  placeholder = "输入名称",
}: AssetNameEditorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {isEditing ? (
        <Input
          value={editedName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm"
        />
      ) : (
        <p className="text-sm p-3 bg-background rounded-md">
          {name || "未命名"}
        </p>
      )}
    </div>
  );
}
