import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { File } from "lucide-react";

export function EmptyState() {
  const { t } = useTranslation();

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center justify-center py-8">
        <File className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          {t("assetManager.noAssets")}
        </p>
      </div>
    </Card>
  );
}
