import { Badge } from "@/components/ui/badge";
import { LocationData } from "@/lib/upload/types";

interface LocationSelectorProps {
  clickedLocation?: LocationData | null;
  locationSelection: {
    gpsSource: { location: LocationData } | null;
    selectedSource: "exif" | "user_click";
    setSelectedSource: (source: "exif" | "user_click") => void;
    hasExifLocation: boolean;
    hasClickedLocation: boolean;
  };
}

export function LocationSelector({
  clickedLocation,
  locationSelection,
}: LocationSelectorProps) {
  const {
    gpsSource,
    selectedSource,
    setSelectedSource,
    hasExifLocation,
    hasClickedLocation,
  } = locationSelection;

  if (!hasExifLocation && !hasClickedLocation) {
    return null;
  }

  return (
    <div className="p-3 bg-muted rounded-md space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold">坐标来源</div>
        {hasExifLocation && hasClickedLocation && (
          <Badge variant="secondary" className="text-xs">
            可选择
          </Badge>
        )}
      </div>

      {/* EXIF 坐标选项 */}
      {hasExifLocation && gpsSource && (
        <button
          onClick={() => setSelectedSource("exif")}
          className={`w-full p-2 rounded-md text-left transition-colors ${
            selectedSource === "exif"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-accent"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full border-2 ${
                selectedSource === "exif"
                  ? "border-primary-foreground bg-primary-foreground"
                  : "border-muted-foreground"
              }`}
            />
            <div className="flex-1">
              <div className="text-xs font-semibold">📷 图片GPS坐标</div>
              <div className="font-mono text-xs mt-0.5">
                {gpsSource.location.longitude.toFixed(6)}°,{" "}
                {gpsSource.location.latitude.toFixed(6)}°
              </div>
            </div>
          </div>
        </button>
      )}

      {/* 手动点击坐标选项 */}
      {hasClickedLocation && clickedLocation && (
        <button
          onClick={() => setSelectedSource("user_click")}
          className={`w-full p-2 rounded-md text-left transition-colors ${
            selectedSource === "user_click" || !hasExifLocation
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-accent"
          }`}
          disabled={!hasExifLocation && !hasClickedLocation}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full border-2 ${
                selectedSource === "user_click" || !hasExifLocation
                  ? "border-primary-foreground bg-primary-foreground"
                  : "border-muted-foreground"
              }`}
            />
            <div className="flex-1">
              <div className="text-xs font-semibold">📍 手动点击位置</div>
              <div className="font-mono text-xs mt-0.5">
                {clickedLocation.longitude.toFixed(6)}°,{" "}
                {clickedLocation.latitude.toFixed(6)}°
              </div>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
