"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/typography";
import type { AssetDto, SceneSummaryDto } from "@/lib/content-model/contracts";
import { FieldLabel } from "../AssetEditor/FieldLabel";
import { usePlacementStore } from "../../lib/placement-store";
import { usePlacementMap } from "./PlacementMapContext";
import { PlacementLocationFields } from "./PlacementLocationFields";
import { SourcePicker } from "./SourcePicker";
import { EMPTY_LOCATION, parseLocation, useCreatePlacement, type LocationInput } from "./useCreatePlacement";

export type PickedSource = { kind: "asset"; asset: AssetDto } | { kind: "scene"; scene: SceneSummaryDto };

/**
 * "Place existing content": a project asset (pins its current version) or a
 * published project scene (pins its latest revision) at an explicit location.
 */
export function PlaceExistingForm() {
  const { tx } = usePlacementMap();
  const create = useCreatePlacement();
  // The open editor above owns the primary action; creation steps back to secondary.
  const editorOpen = usePlacementStore((state) => !!(state.selectedPlacementId || state.selectedAnchorId));
  const [source, setSource] = useState<PickedSource | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState<LocationInput>(EMPTY_LOCATION);
  const [problem, setProblem] = useState<string | null>(null);

  const pick = (next: PickedSource | null) => {
    setSource(next);
    create.resetIntent();
  };

  const submit = async () => {
    setProblem(null);
    if (!source) return setProblem(tx("contentModel.integration.map.create.pickSource"));
    const point = parseLocation(location);
    if (point === "invalid") return setProblem(tx("contentModel.integration.map.problem.coordinates"));
    if (!point) return setProblem(tx("contentModel.integration.map.create.locationRequired"));
    const target = source.kind === "asset"
      ? { kind: "asset" as const, assetId: source.asset.id }
      : source.scene.latest_revision && { kind: "scene_revision" as const, sceneRevisionId: source.scene.latest_revision.id };
    if (!target) return setProblem(tx("contentModel.integration.map.create.noVersion"));
    const created = await create.submit(async () => ({ target, name: name.trim() || undefined, location: point, status: "active" }));
    if (created) {
      setSource(null);
      setName("");
      setLocation(EMPTY_LOCATION);
    }
  };

  return (
    <div className="space-y-4">
      <SourcePicker value={source} onChange={pick} />
      <div className="space-y-1">
        <FieldLabel htmlFor="place-existing-name">{tx("contentModel.integration.map.field.name")}</FieldLabel>
        <Input id="place-existing-name" value={name} placeholder={tx("contentModel.integration.map.field.namePlaceholder")} onChange={(event) => setName(event.target.value)} />
      </div>
      <PlacementLocationFields {...location} disabled={false} onChange={(patch) => setLocation((current) => ({ ...current, ...patch }))} />
      {(problem || create.error) && <Text as="p" variant="bodySm" tone="critical" role="alert">{problem ?? create.error}</Text>}
      <Button className="w-full" variant={editorOpen ? "secondary" : "default"} onClick={submit} disabled={create.pending}>
        {create.pending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
        {tx("contentModel.integration.map.create.placeAction")}
      </Button>
    </div>
  );
}
