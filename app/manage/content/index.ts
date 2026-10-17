// Presentational layer for team assets and scenes. Pages own data, permissions
// and navigation, and pass them in through props and ContentAction callbacks.

export * from "./types";
export { useContentAction, type ContentActionFailure } from "./useContentAction";
export { useContentFormat } from "./useContentFormat";

export { ContentStatusBadge, type ContentBadgeKind } from "./ContentStatusBadge";
export { ContentThumbnail } from "./ContentThumbnail";
export { ContentContextLine } from "./ContentContextLine";
export { ContentSection } from "./ContentSection";
export { ContentEmptyState, ContentErrorState, ContentFailureNotice, ContentListSkeleton, ContentNotice } from "./ContentFeedback";
export { ProjectRoleBadge, ProjectRoleSelect, PROJECT_ROLES } from "./ProjectRoleSelect";

export { AssetLibrary, type AssetLibraryProps } from "./AssetLibrary";
export { AssetLibraryToolbar, ASSET_TYPES, hasActiveAssetFilters } from "./AssetLibraryToolbar";
export { AssetLibraryRow } from "./AssetLibraryRow";

export { AssetDetail, type AssetDetailProps } from "./AssetDetail";
export { AssetDetailHeader } from "./AssetDetailHeader";
export { AssetVersionHistory } from "./AssetVersionHistory";
export { AssetVersionUploadDialog, type AssetVersionInput } from "./AssetVersionUploadDialog";
export { AssetUsagePanel } from "./AssetUsagePanel";
export { AssetSharingPanel } from "./AssetSharingPanel";
export { AssetGrantRow } from "./AssetGrantRow";
export { AssetGrantPicker } from "./AssetGrantPicker";
export { AssetMaintenancePanel } from "./AssetMaintenancePanel";
export { AssetMaintainerDialog } from "./AssetMaintainerDialog";
export { AssetArchiveDialog } from "./AssetArchiveDialog";

export { SceneList, type SceneListProps } from "./SceneList";
export { SceneListToolbar } from "./SceneListToolbar";
export { SceneListRow } from "./SceneListRow";
export { SceneNameDialog } from "./SceneNameDialog";
export { SceneCopyDialog, type SceneCopyInput } from "./SceneCopyDialog";
export { SceneArchiveDialog } from "./SceneArchiveDialog";

export { AssetVersionUpgrade, type UpgradeScope } from "./AssetVersionUpgrade";
export { PlacementTargetSelect } from "./PlacementTargetSelect";
