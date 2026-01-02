import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";

export function LoadingState() {
  const { t } = useTranslation();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {t("assetManager.loading")}
        </p>
      </div>
    </Card>
  );
}
