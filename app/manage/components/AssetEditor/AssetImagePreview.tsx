"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PhotoSlider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

interface AssetImagePreviewProps {
  fileUrl: string;
  fileName: string;
}

export function AssetImagePreview({
  fileUrl,
  fileName,
}: AssetImagePreviewProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {t("assetEditor.preview.image")}
      </label>
      <div
        className="rounded-md overflow-hidden border cursor-zoom-in"
        onClick={() => setVisible(true)}
      >
        <img src={fileUrl} alt={fileName} className="w-full h-auto" />
      </div>
      <PhotoSlider
        images={[{ src: fileUrl, key: fileUrl }]}
        visible={visible}
        onClose={() => setVisible(false)}
        index={0}
      />
      <p className="text-xs text-muted-foreground truncate">{fileUrl}</p>
    </div>
  );
}
