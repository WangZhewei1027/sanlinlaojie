import { useState, useTransition } from "react";
import { FILE_TYPE_CONFIGS } from "@/lib/upload/config";
import { updateOrganization } from "../actions";
import type { OrgData } from "../types";
import type { TextAssetMiniappStyle } from "@/app/manage/types";

export const ALL_FILE_TYPES = Object.keys(FILE_TYPE_CONFIGS) as Array<
  keyof typeof FILE_TYPE_CONFIGS
>;

export function useOrgDetailForm(org: OrgData, onSuccess: () => void) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [lat, setLat] = useState(
    org.map_center?.lat != null ? String(org.map_center.lat) : "",
  );
  const [lng, setLng] = useState(
    org.map_center?.lng != null ? String(org.map_center.lng) : "",
  );
  const [fileTypes, setFileTypes] = useState<Set<string>>(
    new Set(org.allowed_file_types ?? []),
  );
  const [textAssetMiniappStyle, setTextAssetMiniappStyle] =
    useState<TextAssetMiniappStyle>(
      (org.config?.text_asset_miniapp_style as TextAssetMiniappStyle) ??
        "plain_white",
    );
  const [confettiEnabled, setConfettiEnabled] = useState<boolean>(
    org.config?.confetti_enabled ?? false,
  );
  const [shopCheckinEnabled, setShopCheckinEnabled] = useState<boolean>(
    org.config?.shop_checkin_enabled ?? false,
  );
  const [footerEnabled, setFooterEnabled] = useState<boolean>(
    org.config?.footer_enabled ?? false,
  );
  const [saveError, setSaveError] = useState("");

  const hasChanged =
    name !== org.name ||
    description !== (org.description ?? "") ||
    lat !== (org.map_center?.lat != null ? String(org.map_center.lat) : "") ||
    lng !== (org.map_center?.lng != null ? String(org.map_center.lng) : "") ||
    JSON.stringify([...fileTypes].sort()) !==
      JSON.stringify([...(org.allowed_file_types ?? [])].sort()) ||
    textAssetMiniappStyle !==
      ((org.config?.text_asset_miniapp_style as TextAssetMiniappStyle) ??
        "plain_white") ||
    confettiEnabled !== (org.config?.confetti_enabled ?? false) ||
    shopCheckinEnabled !== (org.config?.shop_checkin_enabled ?? false) ||
    footerEnabled !== (org.config?.footer_enabled ?? false);

  const toggleFileType = (type: string) => {
    setFileTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    setSaveError("");

    const latNum = lat.trim() ? parseFloat(lat) : null;
    const lngNum = lng.trim() ? parseFloat(lng) : null;
    const mapCenter =
      latNum != null && lngNum != null && !isNaN(latNum) && !isNaN(lngNum)
        ? { lat: latNum, lng: lngNum }
        : null;

    const selectedTypes = [...fileTypes];
    const allSelected = selectedTypes.length === ALL_FILE_TYPES.length;

    startTransition(async () => {
      const result = await updateOrganization(org.id, {
        name: name.trim(),
        description: description.trim() || null,
        map_center: mapCenter,
        allowed_file_types: allSelected ? null : selectedTypes,
        config: {
          ...org.config,
          text_asset_miniapp_style: textAssetMiniappStyle,
          confetti_enabled: confettiEnabled,
          shop_checkin_enabled: shopCheckinEnabled,
          footer_enabled: footerEnabled,
        },
      });
      if (result.error) {
        setSaveError(result.error);
      } else {
        onSuccess();
      }
    });
  };

  return {
    name,
    setName,
    description,
    setDescription,
    lat,
    setLat,
    lng,
    setLng,
    fileTypes,
    toggleFileType,
    textAssetMiniappStyle,
    setTextAssetMiniappStyle,
    confettiEnabled,
    setConfettiEnabled,
    shopCheckinEnabled,
    setShopCheckinEnabled,
    footerEnabled,
    setFooterEnabled,
    saveError,
    hasChanged,
    handleSave,
    isPending,
  };
}
