"use client";

import { useEffect, useRef, useState } from "react";

export default function ARPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [arReady, setArReady] = useState(false);

  useEffect(() => {
    // 监听来自 iframe 的消息
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "AR_READY" && event.data.source === "zappar-ar") {
        setArReady(true);
        console.log("AR scene is ready");
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleResetAR = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "RESET_AR",
        },
        "*"
      );
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* AR iframe */}
      <iframe
        ref={iframeRef}
        src="/ar/index.html"
        className="w-full h-full border-0"
        allow="camera; microphone; accelerometer; gyroscope; magnetometer; xr-spatial-tracking"
        title="Zappar AR Experience"
      />

      {/* 调试信息 - 仅在开发环境显示 */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute top-4 right-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
          <p>AR Status: {arReady ? "Ready" : "Loading..."}</p>
          <button
            onClick={handleResetAR}
            className="mt-2 px-3 py-1 bg-blue-500 rounded text-xs hover:bg-blue-600"
          >
            Reset AR
          </button>
        </div>
      )}
    </div>
  );
}
