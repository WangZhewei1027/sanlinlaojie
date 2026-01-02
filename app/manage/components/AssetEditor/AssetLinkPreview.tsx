interface AssetLinkPreviewProps {
  fileUrl: string;
  fileName: string;
}

export function AssetLinkPreview({ fileUrl, fileName }: AssetLinkPreviewProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">链接预览</label>
      <div className="rounded-md overflow-hidden border bg-background">
        <iframe
          src={fileUrl}
          title={fileName}
          className="w-full h-[400px] border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
      <p className="text-xs text-muted-foreground truncate">{fileUrl}</p>
    </div>
  );
}
