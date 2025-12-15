import { useRef, useEffect, useState } from "react";
import { Camera, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CameraUploadProps {
  onUpload: (imageData: string) => Promise<void>;
  disabled: boolean;
}

export function CameraUpload({ onUpload, disabled }: CameraUploadProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // 启动相机
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1920, height: 1080 },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("无法访问相机：", err);
    }
  };

  // 停止相机
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 拍照
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedImage(imageData);
    }
  };

  // 重新拍照
  const retakePhoto = () => {
    setCapturedImage(null);
  };

  // 上传照片
  const handleUpload = async () => {
    if (!capturedImage) return;

    setUploading(true);
    try {
      await onUpload(capturedImage);
      setCapturedImage(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      {!capturedImage ? (
        <div className="relative bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full aspect-[4/3] object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
            <Button
              size="lg"
              className="w-full"
              onClick={capturePhoto}
              disabled={!cameraStream || disabled}
            >
              <Camera className="h-5 w-5 mr-2" />
              拍照
            </Button>
          </div>
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
                  上传中...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  确认上传
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
              重新拍照
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
