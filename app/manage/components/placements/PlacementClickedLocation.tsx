"use client";

import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { usePlacementStore } from "../../lib/placement-store";
import { usePlacementMap } from "./PlacementMapContext";
import { formatCoordinate } from "./placement-utils";

/** Last map click; placement location fields copy it only on an explicit action. */
export function PlacementClickedLocation() {
  const { tx } = usePlacementMap();
  const point = usePlacementStore((state) => state.clickedLocation);
  return (
    <Card className="space-y-1.5 p-3">
      <div className="flex items-center gap-1.5">
        <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
        <Text as="h3" variant="bodySm" fontWeight="semibold">{tx("contentModel.integration.map.clicked.title")}</Text>
      </div>
      {point ? (
        <p className="font-mono text-sm tabular-nums">
          {formatCoordinate(point.longitude)}, {formatCoordinate(point.latitude)} · {formatCoordinate(point.height, 2)} m
        </p>
      ) : (
        <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.map.clicked.prompt")}</Text>
      )}
    </Card>
  );
}
