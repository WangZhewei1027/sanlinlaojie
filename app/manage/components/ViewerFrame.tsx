import { RefObject } from "react";
import { MANAGE_CONFIG } from "../config";

interface ViewerFrameProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  sidebarOpen: boolean;
}

export function ViewerFrame({ iframeRef, sidebarOpen }: ViewerFrameProps) {
  return (
    <div
      className="relative transition-all duration-300 ease-in-out"
      style={{
        width: sidebarOpen
          ? `calc(100% - ${MANAGE_CONFIG.SIDEBAR_WIDTH}px)`
          : "100%",
      }}
    >
      <iframe
        ref={iframeRef}
        src="/js/viewer/index.html"
        className="w-full h-full border-0"
        title="3D Viewer"
      />
    </div>
  );
}
