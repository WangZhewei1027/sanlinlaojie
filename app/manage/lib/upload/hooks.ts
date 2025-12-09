import { useState } from "react";
import { LocationData, GPSSource } from "./types";

/**
 * 位置选择 Hook
 */
export function useLocationSelection(clickedLocation?: LocationData | null) {
  const [gpsSource, setGpsSource] = useState<GPSSource | null>(null);
  const [selectedSource, setSelectedSource] = useState<"exif" | "user_click">(
    "exif"
  );

  /**
   * 设置来自 EXIF 的 GPS
   */
  const setExifLocation = (location: LocationData | null) => {
    if (location) {
      setGpsSource({
        type: "exif",
        location,
        timestamp: new Date().toISOString(),
      });
      setSelectedSource("exif");
    } else {
      setGpsSource(null);
    }
  };

  /**
   * 获取最终选择的位置
   */
  const getFinalLocation = (): {
    location: LocationData | null;
    source: GPSSource["type"] | null;
  } => {
    if (gpsSource && selectedSource === "exif") {
      return { location: gpsSource.location, source: "exif" };
    }
    if (clickedLocation) {
      return { location: clickedLocation, source: "user_click" };
    }
    return { location: null, source: null };
  };

  return {
    gpsSource,
    selectedSource,
    setExifLocation,
    setSelectedSource,
    getFinalLocation,
    hasExifLocation: !!gpsSource,
    hasClickedLocation: !!clickedLocation,
  };
}
