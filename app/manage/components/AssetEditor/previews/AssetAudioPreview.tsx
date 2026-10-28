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
      <label className="text-xs font-medium text-muted-foreground">
        {t("assetEditor.preview.audio")}
      </label>
      <div className="rounded-md border p-4 bg-muted/30">
        <audio src={fileUrl} controls className="w-full" preload="metadata">
          {t("assetEditor.preview.audioNotSupported")}
        </audio>
      </div>
      <p className="text-xs text-muted-foreground truncate">{fileUrl}</p>
    </div>
  );
}
