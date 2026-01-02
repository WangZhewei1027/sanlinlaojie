import { Camera, Type, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

type UploadMode = "camera" | "text" | "audio";

interface ModeSelectorProps {
  mode: UploadMode;
  onModeChange: (mode: UploadMode) => void;
}

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-2">
      <Button
        variant={mode === "camera" ? "default" : "outline"}
        className="flex-1"
        onClick={() => onModeChange("camera")}
      >
        <Camera className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">{t("onsite.cameraMode")}</span>
      </Button>
      <Button
        variant={mode === "text" ? "default" : "outline"}
        className="flex-1"
        onClick={() => onModeChange("text")}
      >
        <Type className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">{t("onsite.textMode")}</span>
      </Button>
      <Button
        variant={mode === "audio" ? "default" : "outline"}
        className="flex-1"
        onClick={() => onModeChange("audio")}
      >
        <Mic className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">{t("onsite.audioMode")}</span>
      </Button>
    </div>
  );
}
