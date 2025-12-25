interface AssetAudioPreviewProps {
  fileUrl: string;
  fileName: string;
}

export function AssetAudioPreview({
  fileUrl,
  fileName: _fileName,
}: AssetAudioPreviewProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">音频预览</label>
      <div className="rounded-md border p-4 bg-muted/30">
        <audio controls className="w-full" preload="metadata">
          <source src={fileUrl} type="audio/webm" />
          <source src={fileUrl} type="audio/mpeg" />
          <source src={fileUrl} type="audio/wav" />
          您的浏览器不支持音频播放。
        </audio>
      </div>
      <p className="text-xs text-muted-foreground truncate">{fileUrl}</p>
    </div>
  );
}
