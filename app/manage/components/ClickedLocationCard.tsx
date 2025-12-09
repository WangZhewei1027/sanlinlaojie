import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { LocationData } from "../types";

interface ClickedLocationCardProps {
  clickedLocation: LocationData | null;
}

export function ClickedLocationCard({
  clickedLocation,
}: ClickedLocationCardProps) {
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">点击位置</h3>
        </div>
        {clickedLocation ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">经度:</span>
              <span className="font-mono">
                {clickedLocation.longitude.toFixed(6)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">纬度:</span>
              <span className="font-mono">
                {clickedLocation.latitude.toFixed(6)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">高度:</span>
              <span className="font-mono">
                {clickedLocation.height.toFixed(2)}m
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">点击地图查看坐标...</p>
        )}
      </div>
    </Card>
  );
}
