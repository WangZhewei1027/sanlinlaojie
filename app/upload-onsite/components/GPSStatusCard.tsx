import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

  const ready = !!gpsPosition && !gpsError;
  const state = gpsError ? "error" : ready ? "ready" : "loading";

  const tone = {
    ready: {
      ring: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
    loading: {
      ring: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
      dot: "bg-amber-500",
    },
    error: {
      ring: "bg-destructive/10 text-destructive",
      dot: "bg-destructive",
    },
  }[state];

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">{t("onsite.gpsStatus")}</h2>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
            tone.ring,
          )}
        >
          {gpsLoading && !gpsPosition ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : gpsError ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <MapPin className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 flex-shrink-0 rounded-full",
                tone.dot,
                ready && "animate-pulse",
              )}
            />
            <span className="text-sm font-medium">
              {gpsError
                ? gpsError
                : ready
                  ? `${gpsPosition.latitude.toFixed(5)}, ${gpsPosition.longitude.toFixed(5)}`
                  : t("onsite.gettingLocation")}
            </span>
          </div>

          {ready && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>
                {t("onsite.accuracy")}±{gpsPosition.accuracy.toFixed(0)}m
              </span>
              {gpsPosition.altitude !== null && (
                <span>
                  {t("onsite.altitude")}
                  {gpsPosition.altitude.toFixed(0)}m
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
