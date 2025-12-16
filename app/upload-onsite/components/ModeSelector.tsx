import { Camera, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

type UploadMode = "camera" | "text";

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
        <Camera className="h-4 w-4 mr-2" />
        {t("onsite.cameraMode")}
      </Button>
      <Button
        variant={mode === "text" ? "default" : "outline"}
        className="flex-1"
        onClick={() => onModeChange("text")}
      >
        <Type className="h-4 w-4 mr-2" />
        {t("onsite.textMode")}
      </Button>
    </div>
  );
}
