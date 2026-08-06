import { useEffect, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Asset, LocationData, ViewerMessage } from "../types";
import { useManageStore } from "../store";
import { fetchJson } from "@/lib/fetch-json";

interface AssetMove {
  assetId: string;
  longitude: number;
  latitude: number;
  height: number;
}

interface UseViewerMessagingProps {
  assets: Asset[];
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

export function useViewerMessaging({
  assets,
  iframeRef,
}: UseViewerMessagingProps) {
  const { t } = useTranslation();
  const setClickedLocation = useManageStore(
    (state) => state.setClickedLocation,
  );
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );
  const setSelectedAssetId = useManageStore(
    (state) => state.setSelectedAssetId,
  );
  const setSelectedAssetIds = useManageStore(
    (state) => state.setSelectedAssetIds,
  );
  const updateAssetInStore = useManageStore((state) => state.updateAsset);

  // 发送 organization map_center (origin) 到 viewer iframe
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    if (!selectedOrganization?.map_center) return;

    const sendOrigin = () => {
      if (!iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(
        {
          type: "SET_ORIGIN",
          payload: selectedOrganization.map_center,
          source: "manage",
          version: 1,
        } as unknown as ViewerMessage,
        "*",
      );
    };

    const iframe = iframeRef.current;
    iframe.addEventListener("load", sendOrigin);
    sendOrigin();

    return () => {
      iframe.removeEventListener("load", sendOrigin);
    };
  }, [selectedOrganization?.map_center, iframeRef]);

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
          "*",
        );
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
    // 拖动松手：一次请求批量写入所有被拖素材的 location + metadata，并更新本地 store
    const persistMoves = async (moves: AssetMove[]) => {
      if (moves.length === 0) return;
      try {
        await fetchJson(`/api/assets/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moves }),
        });
        // 服务端已落库，同步本地 store 的 metadata 坐标（location 仅服务端用）
        const currentAssets = useManageStore.getState().assets;
        moves.forEach((m) => {
          updateAssetInStore(m.assetId, {
            metadata: {
              ...(currentAssets.find((a) => a.id === m.assetId)?.metadata ?? {}),
              longitude: m.longitude,
              latitude: m.latitude,
              height: m.height,
            },
          });
        });
        toast.success(t("manage.toasts.movesSaved", { count: moves.length }));
      } catch {
        // fetchJson 已弹出错误 toast
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== "viewer") return;
      // 验证消息格式
      if (event.data?.type === "LOCATION_CLICKED") {
        setClickedLocation(event.data.payload as LocationData);
      } else if (event.data?.type === "ASSET_CLICKED") {
        const { assetId } = event.data.payload as { assetId: string };
        setSelectedAssetId(assetId);
      } else if (event.data?.type === "ASSETS_MOVED") {
        const { moves } = event.data.payload as { moves: AssetMove[] };
        void persistMoves(moves ?? []);
      } else if (event.data?.type === "ASSETS_SELECTED") {
        const { assetIds } = event.data.payload as { assetIds: string[] };
        setSelectedAssetIds(assetIds ?? []);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    setClickedLocation,
    setSelectedAssetId,
    setSelectedAssetIds,
    updateAssetInStore,
    t,
  ]);

  // 发送聚焦资产消息到 viewer
  const focusAsset = (asset: Asset) => {
    // 聚焦即选中该素材（高亮列表卡片 + 打开编辑器）
    setSelectedAssetId(asset.id);

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
      "*",
    );
  };

  // 清除 viewer 端的选中高亮（父级操作条“取消”后调用）
  const clearViewerSelection = () => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: "CLEAR_SELECTION",
        payload: {},
        source: "manage",
        version: 1,
      } as unknown as ViewerMessage,
      "*",
    );
  };

  return {
    focusAsset,
    clearViewerSelection,
  };
}
