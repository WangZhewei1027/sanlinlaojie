"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldLabel } from "../AssetEditor/FieldLabel";
import { usePlacementMap } from "./PlacementMapContext";
import type { FormProblem, PlacementFormValues } from "./usePlacementForm";

interface PlacementRenderFieldsProps {
  type: string;
  values: PlacementFormValues;
  editable: boolean;
  problem: FormProblem | null;
  onChange: (patch: Partial<PlacementFormValues>) => void;
}

/**
 * Per-placement presentation overrides with the legacy meaning
 * (AssetEditorModelConfigFields / AssetEditorTextStyleFields): models get
 * "huge model" + scale multiplier, text gets color + size.
 */
export function PlacementRenderFields({ type, values, editable, problem, onChange }: PlacementRenderFieldsProps) {
  const { tx } = usePlacementMap();
  const id = useId();
  if (type === "model") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox id={`${id}-huge`} checked={values.isHuge} disabled={!editable} onCheckedChange={(checked) => onChange({ isHuge: checked === true })} />
          <Label htmlFor={`${id}-huge`} className="text-sm font-normal">{tx("contentModel.integration.map.field.isHuge")}</Label>
        </div>
        <div className="space-y-1">
          <FieldLabel htmlFor={`${id}-scale`}>{tx("contentModel.integration.map.field.scale")}</FieldLabel>
          <Input id={`${id}-scale`} type="number" step="0.1" min="0.01" value={values.scale} disabled={!editable} placeholder={tx("contentModel.integration.map.field.scaleDefault")} onChange={(event) => onChange({ scale: event.target.value })} />
          {problem === "scale" && <p role="alert" className="text-xs text-destructive">{tx("contentModel.integration.map.problem.scale")}</p>}
        </div>
      </div>
    );
  }
  if (type === "text") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <FieldLabel htmlFor={`${id}-color`}>{tx("contentModel.integration.map.field.textColor")}</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              id={`${id}-color`}
              type="color"
              value={values.textColor || "#ffffff"}
              disabled={!editable}
              onChange={(event) => onChange({ textColor: event.target.value })}
              className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="text-sm text-muted-foreground">{values.textColor || tx("contentModel.integration.map.field.default")}</span>
          </div>
        </div>
        <div className="space-y-1">
          <FieldLabel htmlFor={`${id}-size`}>{tx("contentModel.integration.map.field.textSize")}</FieldLabel>
          <Input id={`${id}-size`} type="number" step="0.1" min="0.1" value={values.textSize} disabled={!editable} placeholder={tx("contentModel.integration.map.field.default")} onChange={(event) => onChange({ textSize: event.target.value })} />
          {problem === "textSize" && <p role="alert" className="text-xs text-destructive">{tx("contentModel.integration.map.problem.textSize")}</p>}
        </div>
      </div>
    );
  }
  return null;
}
