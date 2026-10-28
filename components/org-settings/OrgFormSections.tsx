"use client";

import type { TextAssetMiniappStyle } from "@/app/manage/types";
import { MapCenterSection } from "./MapCenterSection";
import { FileTypesSection } from "./FileTypesSection";
import { TextAssetStyleSection } from "./TextAssetStyleSection";
import { MiniappConfigSection } from "./MiniappConfigSection";

interface OrgFormSectionsProps {
  lat: string;
  setLat: (v: string) => void;
  lng: string;
  setLng: (v: string) => void;
  fileTypes: Set<string>;
  toggleFileType: (type: string) => void;
  textAssetMiniappStyle: TextAssetMiniappStyle;
  setTextAssetMiniappStyle: (v: TextAssetMiniappStyle) => void;
  confettiEnabled: boolean;
  setConfettiEnabled: (v: boolean) => void;
  footerEnabled: boolean;
  setFooterEnabled: (v: boolean) => void;
}

export function OrgFormSections({
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
  footerEnabled,
  setFooterEnabled,
}: OrgFormSectionsProps) {
  return (
    <>
      <div className="border-t" />
      <MapCenterSection lat={lat} setLat={setLat} lng={lng} setLng={setLng} />

      <div className="border-t" />
      <FileTypesSection fileTypes={fileTypes} toggleFileType={toggleFileType} />

      <div className="border-t" />
      <TextAssetStyleSection
        textAssetMiniappStyle={textAssetMiniappStyle}
        setTextAssetMiniappStyle={setTextAssetMiniappStyle}
      />

      <div className="border-t" />
      <MiniappConfigSection
        confettiEnabled={confettiEnabled}
        setConfettiEnabled={setConfettiEnabled}
        footerEnabled={footerEnabled}
        setFooterEnabled={setFooterEnabled}
      />
    </>
  );
}
