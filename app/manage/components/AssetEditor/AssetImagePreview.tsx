import { useTranslation } from "react-i18next";

interface AssetImagePreviewProps {
  fileUrl: string;
  fileName: string;
}

export function AssetImagePreview({
  fileUrl,
  fileName,
}: AssetImagePreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {t("assetEditor.preview.image")}
      </label>
      <div className="rounded-md overflow-hidden border">
        <img src={fileUrl} alt={fileName} className="w-full h-auto" />
      </div>
      <p className="text-xs text-muted-foreground truncate">{fileUrl}</p>
    </div>
  );
}
