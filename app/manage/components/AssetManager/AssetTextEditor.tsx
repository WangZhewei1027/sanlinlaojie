import { Textarea } from "@/components/ui/textarea";

interface AssetTextEditorProps {
  textContent?: string | null;
  isEditing: boolean;
  editedText: string;
  onTextChange: (text: string) => void;
}

export function AssetTextEditor({
  textContent,
  isEditing,
  editedText,
  onTextChange,
}: AssetTextEditorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">文本内容</label>
      {isEditing ? (
        <Textarea
          value={editedText}
          onChange={(e) => onTextChange(e.target.value)}
          rows={3}
          className="text-sm"
        />
      ) : (
        <p className="text-sm p-3 bg-background rounded-md">
          {textContent || "无内容"}
        </p>
      )}
    </div>
  );
}
