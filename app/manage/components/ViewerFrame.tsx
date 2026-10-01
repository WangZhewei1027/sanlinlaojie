import { RefObject } from "react";

interface ViewerFrameProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

// The viewer is a static page; it learns where the Cesium build / 3D tiles
// live (object storage) and the optional 天地图 key from its own query string.
// See public/js/viewer/src/utils/config.js.
function viewerSrc(): string {
  const params = new URLSearchParams();
  const media = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (media) params.set("media", media);
  const tianditu = process.env.NEXT_PUBLIC_TIANDITU_KEY;
  if (tianditu) params.set("tdt", tianditu);
  const query = params.toString();
  return `/js/viewer/index.html${query ? `?${query}` : ""}`;
}

export function ViewerFrame({ iframeRef }: ViewerFrameProps) {
  return (
    <div className="w-full h-full">
      <iframe
        ref={iframeRef}
        src={viewerSrc()}
        className="w-full h-full border-0"
        title="3D Viewer"
      />
    </div>
  );
}
