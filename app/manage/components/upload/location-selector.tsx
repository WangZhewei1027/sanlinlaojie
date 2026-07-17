import { useTranslation } from "react-i18next";
import { Camera, MapPin, Check } from "lucide-react";
import { cn } from "@/lib/utils";
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
  /** 用户已开始填写内容（选了文件/输入了文字等），无坐标时显示点选提示而非隐藏 */
  hasContent?: boolean;
}

function formatCoords(location: LocationData) {
  return `${location.longitude.toFixed(6)}, ${location.latitude.toFixed(6)}`;
}

interface SourceOptionProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  location: LocationData;
  active: boolean;
  selectable: boolean;
  onSelect: () => void;
}

function SourceOption({
  icon: Icon,
  label,
  location,
  active,
  selectable,
  onSelect,
}: SourceOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!selectable}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "border-input",
        selectable && !active && "hover:bg-accent",
        !selectable && "cursor-default",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-xs text-muted-foreground tabular-nums truncate">
          {formatCoords(location)}
        </div>
      </div>
      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}

export function LocationSelector({
  clickedLocation,
  locationSelection,
  hasContent = false,
}: LocationSelectorProps) {
  const { t } = useTranslation();
  const {
    gpsSource,
    selectedSource,
    setSelectedSource,
    hasExifLocation,
    hasClickedLocation,
  } = locationSelection;

  const showExif = hasExifLocation && !!gpsSource;
  const showClick = hasClickedLocation && !!clickedLocation;

  if (!showExif && !showClick) {
    if (!hasContent) {
      return null;
    }
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-dashed px-3 py-2.5">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          {t("upload.location.clickMapHint")}
        </p>
      </div>
    );
  }

  // 只有一个来源时它即为生效来源；两个都有时以用户选择为准
  const activeSource = !showExif
    ? "user_click"
    : !showClick
      ? "exif"
      : selectedSource;
  const selectable = showExif && showClick;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        {t("upload.location.source")}
      </p>

      {showExif && gpsSource && (
        <SourceOption
          icon={Camera}
          label={t("upload.location.exifGPS")}
          location={gpsSource.location}
          active={activeSource === "exif"}
          selectable={selectable}
          onSelect={() => setSelectedSource("exif")}
        />
      )}

      {showClick && clickedLocation && (
        <SourceOption
          icon={MapPin}
          label={t("upload.location.manualClick")}
          location={clickedLocation}
          active={activeSource === "user_click"}
          selectable={selectable}
          onSelect={() => setSelectedSource("user_click")}
        />
      )}
    </div>
  );
}
