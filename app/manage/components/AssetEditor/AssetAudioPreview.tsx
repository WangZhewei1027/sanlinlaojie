import { useTranslation } from "react-i18next";

interface AssetAudioPreviewProps {
  fileUrl: string;
  fileName: string;
}

export function AssetAudioPreview({
  fileUrl,
  fileName: _fileName,
}: AssetAudioPreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {t("assetEditor.preview.audio")}
      </label>
      <div className="rounded-md border p-4 bg-muted/30">
        <audio controls className="w-full" preload="metadata">
          <source src={fileUrl} type="audio/webm" />
          <source src={fileUrl} type="audio/mpeg" />
          <source src={fileUrl} type="audio/wav" />
          {t("assetEditor.preview.audioNotSupported")}
        </audio>
      </div>
      <p className="text-xs text-muted-foreground truncate">{fileUrl}</p>
    </div>
  );
}
