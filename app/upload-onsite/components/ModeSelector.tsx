import { Camera, Type, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type UploadMode = "camera" | "text" | "audio";

interface ModeSelectorProps {
  mode: UploadMode;
  onModeChange: (mode: UploadMode) => void;
}

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  const { t } = useTranslation();

  const options: { value: UploadMode; icon: typeof Camera; label: string }[] = [
    { value: "camera", icon: Camera, label: t("onsite.cameraMode") },
    { value: "text", icon: Type, label: t("onsite.textMode") },
    { value: "audio", icon: Mic, label: t("onsite.audioMode") },
  ];

  return (
    <div
      role="tablist"
      className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted p-1.5"
    >
      {options.map(({ value, icon: Icon, label }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onModeChange(value)}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 text-xs font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground active:scale-[0.98]",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "text-primary")} />
            <span className="leading-none">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
