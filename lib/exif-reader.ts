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

    if (exif && exif.latitude && exif.longitude) {
      const result = {
        latitude: exif.latitude,
        longitude: exif.longitude,
        altitude: exif.altitude || exif.GPSAltitude,
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
