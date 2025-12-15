import { RefObject } from "react";

interface ViewerFrameProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

export function ViewerFrame({ iframeRef }: ViewerFrameProps) {
  return (
    <div className="w-full h-full">
      <iframe
        ref={iframeRef}
        src="/js/viewer/index.html"
        className="w-full h-full border-0"
        title="3D Viewer"
      />
    </div>
  );
}
