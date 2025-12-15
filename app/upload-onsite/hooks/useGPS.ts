import { useState, useEffect } from "react";

export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  timestamp: number;
}

export function useGPS() {
  const [gpsPosition, setGpsPosition] = useState<GPSPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("您的设备不支持GPS定位");
      setGpsLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setGpsError(null);
        setGpsLoading(false);
      },
      (error) => {
        let errorMessage = "GPS定位失败";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "GPS定位权限被拒绝，请在设置中允许位置访问";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "GPS位置信息不可用";
            break;
          case error.TIMEOUT:
            errorMessage = "GPS定位超时";
            break;
        }
        setGpsError(errorMessage);
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return { gpsPosition, gpsError, gpsLoading };
}
