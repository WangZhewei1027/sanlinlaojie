import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Anchor } from "lucide-react";
import type { Asset } from "../../types";

interface AnchorSelectorProps {
  currentAnchorId?: string | null;
  workspaceId: string;
  isEditing: boolean;
  onAnchorChange: (anchorId: string | null) => void;
}

export function AnchorSelector({
  currentAnchorId,
  workspaceId,
  isEditing,
  onAnchorChange,
}: AnchorSelectorProps) {
  const { t } = useTranslation();
  const [anchors, setAnchors] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchAnchors = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/assets?type=anchor`
        );
        const result = await response.json();

        if (response.ok) {
          // 只获取 anchor 类型的资源
          const anchorAssets = (result.data || []).filter(
            (asset: Asset) => asset.file_type === "anchor"
          );
          setAnchors(anchorAssets);
        }
      } catch (error) {
        console.error(t("assetEditor.anchor.fetchFailed"), error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnchors();
  }, [workspaceId, t]);

  const currentAnchor = anchors.find((a) => a.id === currentAnchorId);

  // 获取显示文本
  const getDisplayText = () => {
    if (loading) return t("assetEditor.anchor.loading");
    if (!currentAnchorId) return t("assetEditor.anchor.none");
    return currentAnchor?.name || t("assetEditor.anchor.unnamed");
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Anchor className="h-4 w-4 text-amber-600" />
        {t("assetEditor.anchor.title")}
      </label>
      {isEditing ? (
        <Select
          value={currentAnchorId || "none"}
          onValueChange={(value) =>
            onAnchorChange(value === "none" ? null : value)
          }
          disabled={loading}
        >
          <SelectTrigger className="text-sm">
            <SelectValue>
              <div className="flex items-center gap-2">
                {currentAnchorId && (
                  <Anchor className="h-3 w-3 text-amber-600" />
                )}
                <span>{getDisplayText()}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("assetEditor.anchor.none")}</SelectItem>
            {anchors.map((anchor) => (
              <SelectItem key={anchor.id} value={anchor.id}>
                <div className="flex items-center gap-2">
                  <Anchor className="h-3 w-3 text-amber-600" />
                  <span>{anchor.name || t("assetEditor.anchor.unnamed")}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="text-sm p-3 bg-background rounded-md flex items-center gap-2">
          {currentAnchor ? (
            <>
              <Anchor className="h-4 w-4 text-amber-600" />
              <span>
                {currentAnchor.name || t("assetEditor.anchor.unnamed")}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {t("assetEditor.anchor.notAssociated")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
