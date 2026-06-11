import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StatusMessagesProps {
  error: string | null;
  success: boolean;
}

export function StatusMessages({ error, success }: StatusMessagesProps) {
  const { t } = useTranslation();

  if (!error && !success) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      {error ? (
        <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-destructive/30 bg-destructive px-4 py-3 text-sm text-destructive-foreground shadow-lg">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <span className="leading-snug">{error}</span>
        </div>
      ) : (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{t("onsite.uploadSuccess")}</span>
        </div>
      )}
    </div>
  );
}
