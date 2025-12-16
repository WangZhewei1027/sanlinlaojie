import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <MapPin className="h-5 w-5 mt-0.5 text-primary" />
        <div className="flex-1 space-y-1">
          <div className="font-medium">{t("onsite.gpsStatus")}</div>
          {gpsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("onsite.gettingLocation")}</span>
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
                <span className="font-medium">{t("onsite.location")}</span>
                {gpsPosition.latitude.toFixed(6)},{" "}
                {gpsPosition.longitude.toFixed(6)}
              </div>
              {gpsPosition.altitude !== null && (
                <div className="text-muted-foreground">
                  <span className="font-medium">{t("onsite.altitude")}</span>
                  {gpsPosition.altitude.toFixed(1)}m
                </div>
              )}
              <div className="text-muted-foreground">
                <span className="font-medium">{t("onsite.accuracy")}</span>±
                {gpsPosition.accuracy.toFixed(1)}m
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
