import { useEffect, RefObject } from "react";
import type { Asset, LocationData, ViewerMessage } from "../types";
import { useManageStore } from "../store";

interface UseViewerMessagingProps {
  assets: Asset[];
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

export function useViewerMessaging({
  assets,
  iframeRef,
}: UseViewerMessagingProps) {
  const setClickedLocation = useManageStore(
    (state) => state.setClickedLocation
  );

  // 发送 assets 数据到 viewer iframe
  useEffect(() => {
    if (!iframeRef.current) return;

    const sendAssetsToViewer = () => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: "SET_ASSETS",
            payload: assets,
            source: "manage",
            version: 1,
          } as ViewerMessage,
          "*"
        );
        console.log("发送 assets 到 viewer:", assets.length);
      }
    };

    // iframe 加载完成后发送数据
    const iframe = iframeRef.current;
    iframe.addEventListener("load", sendAssetsToViewer);

    // 如果 iframe 已经加载，立即发送
    if (iframe.contentWindow) {
      sendAssetsToViewer();
    }

    return () => {
      iframe.removeEventListener("load", sendAssetsToViewer);
    };
  }, [assets, iframeRef]);

  // 监听来自 viewer 的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 验证消息格式
      if (
        event.data?.type === "LOCATION_CLICKED" &&
        event.data?.source === "viewer"
      ) {
        setClickedLocation(event.data.payload as LocationData);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setClickedLocation]);

  // 发送聚焦资产消息到 viewer
  const focusAsset = (asset: Asset) => {
    if (!iframeRef.current?.contentWindow) return;

    iframeRef.current.contentWindow.postMessage(
      {
        type: "FOCUS_ASSET",
        payload: {
          id: asset.id,
          longitude: asset.metadata.longitude,
          latitude: asset.metadata.latitude,
          height: asset.metadata.height,
        },
        source: "manage",
        version: 1,
      } as ViewerMessage,
      "*"
    );
    console.log("聚焦到资产:", asset.id);
  };

  return {
    focusAsset,
  };
}
