import { Button } from "@/components/ui/button";
import { UploadType } from "@/lib/upload/types";
import { FILE_TYPE_CONFIGS } from "@/lib/upload/config";

interface FileTypeSelectorProps {
  selectedType: UploadType;
  onTypeChange: (type: UploadType) => void;
  types?: UploadType[];
}

export function FileTypeSelector({
  selectedType,
  onTypeChange,
  types = ["image", "audio", "link", "text", "anchor"],
}: FileTypeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {types.map((type) => {
        const config = FILE_TYPE_CONFIGS[type];
        const Icon = config.icon;

        return (
          <Button
            key={type}
            variant={selectedType === type ? "default" : "outline"}
            size="sm"
            onClick={() => onTypeChange(type)}
            className="flex-1"
          >
            <Icon className="mr-2 h-4 w-4" />
            {config.label}
          </Button>
        );
      })}
    </div>
  );
}
