"use client";

import { useIntegrationText } from "@/app/manage/lib/integration-text";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { CheckCircle2, Crosshair } from "lucide-react";
import type { GPSPosition } from "../hooks/useGPS";
import { ONSITE_TEXTS } from "../onsite-texts";

/** Device fix the user explicitly chose as the placement location. */
export type ConfirmedLocation = GPSPosition;

const LOW_ACCURACY_METERS = 50;
const MIN_DRIFT_METERS = 25;

/** Great-circle distance in meters (haversine). */
function distanceMeters(a: GPSPosition, b: GPSPosition) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface LocationConfirmProps {
  current: GPSPosition | null;
  confirmed: ConfirmedLocation | null;
  onConfirm: (position: ConfirmedLocation) => void;
  onClear: () => void;
  disabled?: boolean;
}

/**
 * Explicit "use this location" step of the onsite upload. The placement is
 * created only at a confirmed device fix; capture EXIF stays provenance.
 */
export function LocationConfirm({ current, confirmed, onConfirm, onClear, disabled }: LocationConfirmProps) {
  const tx = useIntegrationText(ONSITE_TEXTS);
  const drift = confirmed && current ? distanceMeters(confirmed, current) : 0;
  const drifted = drift > Math.max(MIN_DRIFT_METERS, current?.accuracy ?? 0);

  return (
    <div className="space-y-2 border-t pt-3">
      {confirmed ? (
        <>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <Text as="p" variant="bodySm" fontWeight="medium">
                {tx("contentModel.integration.onsite.location.confirmed")}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued" breakWord>
                {tx("contentModel.integration.onsite.location.coords", {
                  lon: confirmed.longitude.toFixed(6),
                  lat: confirmed.latitude.toFixed(6),
                })}
              </Text>
              <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>{tx("contentModel.integration.onsite.location.accuracy", { meters: confirmed.accuracy.toFixed(0) })}</span>
                {confirmed.altitude !== null && (
                  <span>{tx("contentModel.integration.onsite.location.altitude", { meters: confirmed.altitude.toFixed(0) })}</span>
                )}
              </p>
            </div>
          </div>
          {drifted && (
            <Text as="p" variant="bodySm" tone="warning">
              {tx("contentModel.integration.onsite.location.drift", { meters: drift.toFixed(0) })}
            </Text>
          )}
          <div className="flex flex-wrap gap-2">
            {current && drifted && (
              <Button type="button" variant="outline" size="sm" onClick={() => onConfirm(current)} disabled={disabled}>
                <Crosshair aria-hidden />
                {tx("contentModel.integration.onsite.location.update")}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={disabled}>
              {tx("contentModel.integration.onsite.location.clear")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Text as="p" variant="bodySm" tone="subdued">
            {current
              ? tx("contentModel.integration.onsite.location.hint")
              : tx("contentModel.integration.onsite.location.waiting")}
          </Text>
          {current && current.accuracy > LOW_ACCURACY_METERS && (
            <Text as="p" variant="bodySm" tone="warning">
              {tx("contentModel.integration.onsite.location.lowAccuracy", { meters: current.accuracy.toFixed(0) })}
            </Text>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => current && onConfirm(current)} disabled={!current || disabled}>
            <Crosshair aria-hidden />
            {tx("contentModel.integration.onsite.location.confirm")}
          </Button>
        </>
      )}
    </div>
  );
}
