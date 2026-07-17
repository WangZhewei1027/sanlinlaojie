import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

export function LoadingState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">
        {t("assetManager.loading")}
      </p>
    </div>
  );
}
