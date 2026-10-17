"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { PlacementDto } from "@/lib/content-model/contracts";
import { DEFAULT_UPLOAD_TYPES, type UploadType } from "@/lib/upload/types";
import { ViewerFrame } from "../ViewerFrame";
import { usePlacementViewer } from "../../hooks/usePlacementViewer";
import { useWorkspaceInfo, type ContentContext } from "../../lib/content-context";
import { placementScopeKey, toViewerItems } from "../../lib/placement-to-viewer";
import { usePlacementStore } from "../../lib/placement-store";
import { ManageGridLayout } from "./ManageGridLayout";
import { PlacementMapProvider, type PlacementMapContextValue } from "./PlacementMapContext";
import { PlacementList } from "./PlacementList";
import { PlacementSelectionBar } from "./PlacementSelectionBar";
import { PlacementSidebar } from "./PlacementSidebar";
import { listTabOf, matchesFilters } from "./placement-utils";
import { usePlacementText } from "./placement-texts";
import { usePlacementData } from "./usePlacementData";

/**
 * v2 placement map: Placement list | map iframe | placement sidebar.
 * Rights come only from server capabilities (`placement.capabilities`,
 * project `capabilities.can_edit`); `__all__` is browse-only.
 */
export function PlacementMapView({ context }: { context: ContentContext }) {
  const tx = usePlacementText();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const organizationId = context.organizationId as string;
  const { workspaceId, isAll, organization, workspaces } = context;
  const workspaceInfo = useWorkspaceInfo(workspaceId);
  const workspaceCanEdit = !isAll && !!workspaceId && !!workspaceInfo.workspace?.capabilities.can_edit;

  const data = usePlacementData({ organizationId, workspaceId, isAll, tx });
  const placements = usePlacementStore((state) => state.placements);
  const placementContents = usePlacementStore((state) => state.placementContents);
  const loadedScopeKey = usePlacementStore((state) => state.scopeKey);
  const scopeKey = !isAll && !workspaceId ? null : placementScopeKey(organizationId, workspaceId);
  const statusFilter = usePlacementStore((state) => state.statusFilter);
  const fileTypeFilter = usePlacementStore((state) => state.fileTypeFilter);
  const tagFilter = usePlacementStore((state) => state.tagFilter);

  const visible = useMemo(
    () => loadedScopeKey === scopeKey ? placements.filter((placement) => matchesFilters(placement, { status: statusFilter, fileTypes: fileTypeFilter, tagIds: tagFilter })) : [],
    [placements, loadedScopeKey, scopeKey, statusFilter, fileTypeFilter, tagFilter],
  );
  const items = useMemo(() => toViewerItems(visible, placementContents, scopeKey), [visible, placementContents, scopeKey]);

  const canWrite = useCallback(
    (placement: PlacementDto) =>
      !isAll && !!workspaceId && placement.capabilities.can_edit && !placement.capabilities.read_only_shared,
    [isAll, workspaceId],
  );
  const canCopy = useCallback(
    (placement: PlacementDto) => !isAll && workspaceCanEdit && placement.capabilities.can_copy,
    [isAll, workspaceCanEdit],
  );

  const viewer = usePlacementViewer({ iframeRef, items, mapCenter: organization?.map_center, canWrite, tx });

  // `?placementId=` selects and focuses once the list contains it.
  const requestedId = useSearchParams().get("placementId");
  const applied = useRef<string | null>(null);
  const { focusPlacement } = viewer;
  useEffect(() => {
    if (!requestedId || applied.current === requestedId) return;
    const placement = placements.find((item) => item.id === requestedId);
    if (!placement) return;
    applied.current = requestedId;
    const store = usePlacementStore.getState();
    if (placement.status === "archived") store.setStatusFilter("all");
    store.setTab(listTabOf(placement));
    focusPlacement(placement);
  }, [requestedId, placements, focusPlacement]);

  const workspaceName = useCallback(
    (id: string | null | undefined) => (id ? workspaces.find((item) => item.id === id)?.name ?? id.slice(0, 8) : ""),
    [workspaces],
  );
  const allowedUploadTypes = (organization?.allowed_file_types ?? DEFAULT_UPLOAD_TYPES) as UploadType[];

  const value: PlacementMapContextValue = {
    tx,
    organizationId,
    organization,
    workspaceId,
    isAll,
    workspaces,
    workspaceCanEdit,
    workspaceInfoLoading: workspaceInfo.status === "loading",
    tags: data.tags,
    anchors: data.anchors,
    anchorsStatus: data.anchorsStatus,
    anchorsError: data.anchorsError,
    reloadAnchors: data.reloadAnchors,
    allowedUploadTypes,
    canWrite,
    canCopy,
    focusPlacement: viewer.focusPlacement,
    setViewerSelection: viewer.setViewerSelection,
    clearViewerSelection: viewer.clearViewerSelection,
    workspaceName,
  };

  return (
    <PlacementMapProvider value={value}>
      <ManageGridLayout
        list={<PlacementList visible={visible} />}
        viewer={
          <>
            <PlacementSelectionBar />
            <ViewerFrame iframeRef={iframeRef} />
          </>
        }
        sidebar={<PlacementSidebar />}
      />
    </PlacementMapProvider>
  );
}
