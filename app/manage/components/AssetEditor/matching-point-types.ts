export type MatchingStatus =
  | "loading"
  | "missing_image"
  | "pending"
  | "ready"
  | "failed"
  | "unconfigured"
  | "processing";
export interface MatchingPointPanelProps {
  imageUrl: string | null;
  imageFile: File | null;
  isEditing: boolean;
  status: MatchingStatus;
  error?: string | null;
  canManage: boolean;
  childrenAssets: { id: string; name: string }[];
  availableAssets: { id: string; name: string }[];
  attaching?: boolean;
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
  onRebuild: () => void;
  onAttach: (id: string) => void;
  onDetach: (id: string) => void;
}
