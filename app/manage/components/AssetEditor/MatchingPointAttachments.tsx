"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MatchingPointPanelProps } from "./matching-point-types";
export function MatchingPointAttachments(
  props: Pick<
    MatchingPointPanelProps,
    | "childrenAssets"
    | "availableAssets"
    | "canManage"
    | "isEditing"
    | "attaching"
    | "onAttach"
    | "onDetach"
  >,
) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState("");
  useEffect(() => {
    if (!props.availableAssets.some((a) => a.id === selected)) setSelected("");
  }, [props.availableAssets, selected]);
  return (
    <div className="space-y-2">
      <Text as="h4" variant="bodySm" fontWeight="semibold">
        {t("matching.children")} · {props.childrenAssets.length}
      </Text>
      <Text as="p" variant="bodySm" tone="subdued">
        {t("matching.childrenHint")}
      </Text>
      {!props.childrenAssets.length && (
        <Text as="p" variant="bodySm" tone="subdued">
          {t("matching.emptyChildren")}
        </Text>
      )}
      <ul className="divide-y max-h-64 overflow-y-auto">
        {props.childrenAssets.map((asset) => (
          <li
            key={asset.id}
            className="flex items-center justify-between gap-2 py-2"
          >
            <Text
              as="span"
              variant="bodySm"
              breakWord
              className="min-w-0 flex-1"
            >
              {asset.name}
            </Text>
            {props.canManage && !props.isEditing && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0"
                aria-label={`${t("matching.detach")} ${asset.name}`}
                disabled={props.attaching}
                onClick={() => props.onDetach(asset.id)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {props.canManage &&
        !props.isEditing &&
        props.availableAssets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Select
              value={selected}
              onValueChange={setSelected}
              disabled={props.attaching}
            >
              <SelectTrigger
                className="flex-1 min-w-0"
                aria-label={t("matching.selectChildren")}
              >
                <SelectValue placeholder={t("matching.selectChildren")} />
              </SelectTrigger>
              <SelectContent>
                {props.availableAssets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              disabled={!selected || props.attaching}
              onClick={() => props.onAttach(selected)}
            >
              {t("matching.attach")}
            </Button>
          </div>
        )}
    </div>
  );
}
