"use client";

import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useManageStore } from "../store";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/typography";

export function ClickedLocationCard() {
  const { t } = useTranslation();
  const clickedLocation = useManageStore((state) => state.clickedLocation);

  return (
    <Card className="p-3">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <Text as="h3" variant="bodySm" fontWeight="semibold">
            {t("manage.clickedLocation.title")}
          </Text>
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
