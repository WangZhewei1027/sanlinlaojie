import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  timestamp: number;
}

interface GPSStatusCardProps {
  gpsPosition: GPSPosition | null;
  gpsError: string | null;
  gpsLoading: boolean;
}

export function GPSStatusCard({
  gpsPosition,
  gpsError,
  gpsLoading,
}: GPSStatusCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <MapPin className="h-5 w-5 mt-0.5 text-primary" />
        <div className="flex-1 space-y-1">
          <div className="font-medium">GPS定位状态</div>
          {gpsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>正在获取位置...</span>
            </div>
          )}
          {gpsError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{gpsError}</span>
            </div>
          )}
          {gpsPosition && !gpsError && (
            <div className="text-sm space-y-1">
              <div className="text-muted-foreground">
                <span className="font-medium">位置：</span>
                {gpsPosition.latitude.toFixed(6)},{" "}
                {gpsPosition.longitude.toFixed(6)}
              </div>
              {gpsPosition.altitude !== null && (
                <div className="text-muted-foreground">
                  <span className="font-medium">海拔：</span>
                  {gpsPosition.altitude.toFixed(1)}m
                </div>
              )}
              <div className="text-muted-foreground">
                <span className="font-medium">精度：</span>±
                {gpsPosition.accuracy.toFixed(1)}m
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
