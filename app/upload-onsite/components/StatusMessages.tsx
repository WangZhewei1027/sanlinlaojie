import { AlertCircle, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

interface StatusMessagesProps {
  error: string | null;
  success: boolean;
}

export function StatusMessages({ error, success }: StatusMessagesProps) {
  const { t } = useTranslation();

  return (
    <>
      {error && (
        <Card className="p-4 border-destructive bg-destructive/10">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </Card>
      )}

      {success && (
        <Card className="p-4 border-green-500 bg-green-50 dark:bg-green-950">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Check className="h-5 w-5" />
            <span>{t("onsite.uploadSuccess")}</span>
          </div>
        </Card>
      )}
    </>
  );
}
