"use client";

import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "../SectionHeader";

interface MapCenterSectionProps {
  lat: string;
  setLat: (v: string) => void;
  lng: string;
  setLng: (v: string) => void;
}

export function MapCenterSection({
  lat,
  setLat,
  lng,
  setLng,
}: MapCenterSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-3">
      <SectionHeader
        icon={MapPin}
        label={t("superAdmin.orgs.section.mapCenter", "Map Center")}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="org-lat" className="text-xs text-muted-foreground">
            {t("superAdmin.orgs.mapCenter.lat", "Latitude")}
          </Label>
          <Input
            id="org-lat"
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="31.2304"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-lng" className="text-xs text-muted-foreground">
            {t("superAdmin.orgs.mapCenter.lng", "Longitude")}
          </Label>
          <Input
            id="org-lng"
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="121.4737"
            className="h-8 text-sm"
          />
        </div>
      </div>
      {(lat || lng) && (
        <p className="text-xs text-muted-foreground">
          {lat && lng
            ? `${lat}, ${lng}`
            : t(
                "superAdmin.orgs.mapCenter.incomplete",
                "Both lat and lng are required",
              )}
        </p>
      )}
    </section>
  );
}
