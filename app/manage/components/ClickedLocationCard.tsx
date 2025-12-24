"use client";

import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useManageStore } from "../store";
import { useTranslation } from "react-i18next";

export function ClickedLocationCard() {
  const { t } = useTranslation();
  const clickedLocation = useManageStore((state) => state.clickedLocation);

  return (
    <Card className="p-3">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">
            {t("manage.clickedLocation.title")}
          </h3>
        </div>
        {clickedLocation ? (
          <div className="flex items-center gap-3 text-sm justify-between">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">
                {t("manage.clickedLocation.longitude")}:
              </span>
              <span className="font-mono">
                {clickedLocation.longitude.toFixed(6)}°
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">
                {t("manage.clickedLocation.latitude")}:
              </span>
              <span className="font-mono">
                {clickedLocation.latitude.toFixed(6)}°
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">
                {t("manage.clickedLocation.height")}:
              </span>
              <span className="font-mono">
                {clickedLocation.height.toFixed(2)}m
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("manage.clickedLocation.prompt")}
          </p>
        )}
      </div>
    </Card>
  );
}
