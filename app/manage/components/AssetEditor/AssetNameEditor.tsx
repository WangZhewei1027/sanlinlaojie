import { Input } from "@/components/ui/input";

interface AssetNameEditorProps {
  name?: string | null;
  isEditing: boolean;
  editedName: string;
  onNameChange: (name: string) => void;
}

export function AssetNameEditor({
  name,
  isEditing,
  editedName,
  onNameChange,
}: AssetNameEditorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">锚点名称</label>
      {isEditing ? (
        <Input
          value={editedName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="输入锚点名称"
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
