import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

interface LocationData {
  longitude?: number;
  latitude?: number;
  height?: number;
  gps_source?: string;
}

interface AssetLocationEditorProps {
  metadata: LocationData;
  isEditing: boolean;
  editedLongitude: string;
  editedLatitude: string;
  editedHeight: string;
  onLongitudeChange: (value: string) => void;
  onLatitudeChange: (value: string) => void;
  onHeightChange: (value: string) => void;
}

export function AssetLocationEditor({
  metadata,
  isEditing,
  editedLongitude,
  editedLatitude,
  editedHeight,
  onLongitudeChange,
  onLatitudeChange,
  onHeightChange,
}: AssetLocationEditorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        位置信息
      </label>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">经度</label>
          {isEditing ? (
            <Input
              type="number"
              step="0.000001"
              value={editedLongitude}
              onChange={(e) => onLongitudeChange(e.target.value)}
              className="text-sm"
            />
          ) : (
            <p className="text-sm p-2 bg-background rounded-md">
              {metadata.longitude?.toFixed(6) ?? "N/A"}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">纬度</label>
          {isEditing ? (
            <Input
              type="number"
              step="0.000001"
              value={editedLatitude}
              onChange={(e) => onLatitudeChange(e.target.value)}
              className="text-sm"
            />
          ) : (
            <p className="text-sm p-2 bg-background rounded-md">
              {metadata.latitude?.toFixed(6) ?? "N/A"}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">高度(m)</label>
          {isEditing ? (
            <Input
              type="number"
              step="0.01"
              value={editedHeight}
              onChange={(e) => onHeightChange(e.target.value)}
              className="text-sm"
            />
          ) : (
            <p className="text-sm p-2 bg-background rounded-md">
              {metadata.height?.toFixed(2) ?? "N/A"}
            </p>
          )}
        </div>
      </div>
      {metadata.gps_source && (
        <p className="text-xs text-muted-foreground">
          来源: {metadata.gps_source}
        </p>
      )}
    </div>
  );
}
