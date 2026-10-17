"use client";

import { useId } from "react";
import { Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "../AssetEditor/FieldLabel";
import { usePlacementStore } from "../../lib/placement-store";
import { usePlacementMap } from "./PlacementMapContext";

interface PlacementLocationFieldsProps {
  longitude: string;
  latitude: string;
  altitude: string;
  disabled: boolean;
  onChange: (patch: { longitude?: string; latitude?: string; altitude?: string }) => void;
  /** Extra explicit source, e.g. "use photo GPS" in the create forms. */
  extraAction?: React.ReactNode;
}

/**
 * Longitude / latitude / altitude inputs. A map click never overwrites them
 * by itself; "use clicked map location" copies it explicitly.
 */
export function PlacementLocationFields({ longitude, latitude, altitude, disabled, onChange, extraAction }: PlacementLocationFieldsProps) {
  const { tx } = usePlacementMap();
  const clicked = usePlacementStore((state) => state.clickedLocation);
  const id = useId();
  const fields = [
    { key: "longitude" as const, value: longitude, step: "0.000001", label: tx("contentModel.integration.map.field.longitude") },
    { key: "latitude" as const, value: latitude, step: "0.000001", label: tx("contentModel.integration.map.field.latitude") },
    { key: "altitude" as const, value: altitude, step: "0.01", label: tx("contentModel.integration.map.field.altitude") },
  ];
  return (
    <div className="space-y-2">
      <FieldLabel>{tx("contentModel.integration.map.field.location")}</FieldLabel>
      <div className="grid grid-cols-3 gap-2">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <FieldLabel htmlFor={`${id}-${field.key}`}>{field.label}</FieldLabel>
            <Input
              id={`${id}-${field.key}`}
              type="number"
              inputMode="decimal"
              step={field.step}
              value={field.value}
              disabled={disabled}
              onChange={(event) => onChange({ [field.key]: event.target.value })}
              className="px-2 text-sm"
            />
          </div>
        ))}
      </div>
      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!clicked}
            onClick={() => clicked && onChange({ longitude: String(clicked.longitude), latitude: String(clicked.latitude), altitude: String(clicked.height) })}
          >
            <Crosshair className="size-4" aria-hidden />
            {tx("contentModel.integration.map.field.useClicked")}
          </Button>
          {extraAction}
        </div>
      )}
      {!disabled && !clicked && <p className="text-xs text-muted-foreground">{tx("contentModel.integration.map.field.clickHint")}</p>}
    </div>
  );
}
