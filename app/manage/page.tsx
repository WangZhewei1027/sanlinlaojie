"use client";

import { Suspense, useRef } from "react";
import { useViewerMessaging } from "./hooks/useViewerMessaging";
import { useManageStore } from "./store";
import { ViewerFrame } from "./components/ViewerFrame";
import { ManageSidebar } from "./components/ManageSidebar";
import { MapSelectionBar } from "./components/MapSelectionBar";
import { AssetManager, useAssetAPI } from "./components/AssetManager";
import { ContentFeatureState } from "./components/ContentFeatureState";
import { ManageGridLayout } from "./components/placements/ManageGridLayout";
import { ManageLayoutSkeleton } from "./components/placements/ManageLayoutSkeleton";
import { PlacementMapView } from "./components/placements/PlacementMapView";
import { useContentContext, useContentModel } from "./lib/content-context";

export default function ManagePage() {
  return (
    <Suspense fallback={<ManageLayoutSkeleton />}>
      <ManagePageContent />
    </Suspense>
  );
}

/**
 * Chooses the map surface from the organization's server-declared content
 * model state: `v2` → placement map; everything else → the legacy asset map
 * (`readonly` forces it read-only). Nothing is rendered until the state is
 * known so neither surface flashes for the wrong organization.
 */
function ManagePageContent() {
  const context = useContentContext();
  const model = useContentModel(context.organizationId);

  if (!context.organizationId) {
    // No organization yet: wait for the selector, or fall back to the legacy empty states.
    return context.loading ? <ManageLayoutSkeleton /> : <LegacyManageView readOnly={false} />;
  }
  if (model.status === "loading") return <ManageLayoutSkeleton />;
  if (model.status === "error") {
    return (
      <LegacyManageView
        readOnly
        notice={<ContentFeatureState state="error" mapHref="/manage" error={model.error} onRetry={model.refresh} />}
      />
    );
  }
  if (model.state === "v2") return <PlacementMapView key={context.organizationId} context={context} />;
  const readOnly = model.state === "readonly";
  return (
    <LegacyManageView
      readOnly={readOnly}
      notice={readOnly ? <ContentFeatureState state="readonly" mapHref="/manage" /> : undefined}
    />
  );
}

/** The pre-v2 asset map, unchanged apart from the read-only switch. */
function LegacyManageView({ readOnly, notice }: { readOnly: boolean; notice?: React.ReactNode }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { handleUpdateAsset, handleDeleteAsset } = useAssetAPI();

  // 直接从 zustand store 读取数据（WorkspaceProvider 负责同步）
  const filteredAssets = useManageStore((state) => state.filteredAssets);

  const { focusAsset, clearViewerSelection } = useViewerMessaging({
    assets: filteredAssets,
    iframeRef,
  });

  return (
    <ManageGridLayout
      list={<AssetManager onFocusAsset={focusAsset} />}
      viewer={
        <>
          <MapSelectionBar clearViewerSelection={clearViewerSelection} readOnly={readOnly} />
          {notice && <div className="absolute bottom-2 left-2 right-2 z-20 rounded-md bg-background shadow-sm sm:right-auto sm:max-w-md">{notice}</div>}
          <ViewerFrame iframeRef={iframeRef} />
        </>
      }
      sidebar={
        <ManageSidebar
          onUpload={() => console.log("上传成功")}
          onUpdateAsset={handleUpdateAsset}
          onDeleteAsset={handleDeleteAsset}
          readOnly={readOnly}
        />
      }
    />
  );
}
