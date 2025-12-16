import { useRef, useState } from "react";
import { Camera, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

interface CameraUploadProps {
  onUpload: (imageData: string) => Promise<void>;
  disabled: boolean;
}

export function CameraUpload({ onUpload, disabled }: CameraUploadProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // 触发相机
  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      setCapturedImage(imageData);
    };
    reader.readAsDataURL(file);
  };

  // 重新拍照
  const retakePhoto = () => {
    setCapturedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 上传照片
  const handleUpload = async () => {
    if (!capturedImage) return;

    setUploading(true);
    try {
      await onUpload(capturedImage);
      setCapturedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {!capturedImage ? (
        <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
          <Camera className="h-16 w-16 mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-6 text-center">
            {t("onsite.cameraPrompt")}
          </p>
          <Button
            size="lg"
            className="w-full max-w-xs"
            onClick={triggerCamera}
            disabled={disabled}
          >
            <Camera className="h-5 w-5 mr-2" />
            {t("onsite.takePhoto")}
          </Button>
        </div>
      ) : (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full aspect-[4/3] object-cover"
          />
          <div className="p-4 space-y-2">
            <Button
              size="lg"
              className="w-full"
              onClick={handleUpload}
              disabled={uploading || disabled}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {t("onsite.uploading")}
                </>
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  {t("onsite.confirmUpload")}
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={retakePhoto}
              disabled={uploading}
            >
              {t("onsite.retake")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
