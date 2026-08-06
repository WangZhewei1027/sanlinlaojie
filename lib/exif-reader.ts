import exifr from "exifr";

export interface ImageGPSData {
  latitude: number;
  longitude: number;
  altitude?: number;
}

/**
 * 从图片 EXIF 数据中提取 GPS 坐标
 */
export async function extractGPSFromImage(
  file: File
): Promise<ImageGPSData | null> {
  try {
    // 不限制字段，读取所有 GPS 数据
    const exif = await exifr.parse(file, {
      gps: true,
    });

    console.log("EXIF 数据:", exif);

    // 用类型检查而非真值判断：纬度/经度/海拔为 0 是合法坐标（赤道、本初子午线、海平面）
    const isValidCoord = (value: unknown): value is number =>
      typeof value === "number" && Number.isFinite(value);

    if (exif && isValidCoord(exif.latitude) && isValidCoord(exif.longitude)) {
      const altitude = isValidCoord(exif.altitude)
        ? exif.altitude
        : isValidCoord(exif.GPSAltitude)
          ? exif.GPSAltitude
          : undefined;
      const result = {
        latitude: exif.latitude,
        longitude: exif.longitude,
        altitude,
      };
      console.log("提取到 GPS 坐标:", result);
      return result;
    }

    console.warn("图片不包含 GPS 信息");
    return null;
  } catch (error) {
    console.error("读取图片 GPS 信息失败:", error);
    return null;
  }
}
