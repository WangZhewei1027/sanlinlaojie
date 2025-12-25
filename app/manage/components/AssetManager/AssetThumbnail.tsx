import { File, Anchor, Music } from "lucide-react";

interface AssetThumbnailProps {
  fileType: string;
  fileUrl?: string | null;
  textContent?: string | null;
  fileName: string;
}

export function AssetThumbnail({
  fileType,
  fileUrl,
  textContent,
  fileName,
}: AssetThumbnailProps) {
  return (
    <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
      {fileType === "image" && fileUrl ? (
        <img
          src={fileUrl}
          alt={fileName}
          className="w-full h-full object-cover"
        />
      ) : fileType === "audio" ? (
        <div className="w-full h-full flex items-center justify-center bg-purple-500/20">
          <Music className="h-8 w-8 text-purple-600" />
        </div>
      ) : fileType === "text" && textContent ? (
        <div className="w-full h-full flex items-center justify-center p-2 text-xs text-center text-muted-foreground line-clamp-3">
          {textContent}
        </div>
      ) : fileType === "anchor" ? (
        <div className="w-full h-full flex items-center justify-center bg-amber-500/20">
          <Anchor className="h-8 w-8 text-amber-600" />
        </div>
      ) : (
        <File className="h-8 w-8 text-muted-foreground" />
      )}
    </div>
  );
}
