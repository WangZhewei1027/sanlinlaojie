"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Upload, RotateCcw, Play, Pause } from "lucide-react";

interface AudioRecorderProps {
  onUpload: (audioFile: File) => Promise<void>;
  disabled?: boolean;
}

export function AudioRecorder({ onUpload, disabled }: AudioRecorderProps) {
  const { t } = useTranslation();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 触发系统录音接口
  const handleRecordClick = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 清理旧的 URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setIsPlaying(false);

      // 重置 input 以允许选择同一个文件
      event.target.value = "";
    }
  };

  // 重新录音
  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioFile(null);
    setAudioUrl(null);
    setIsPlaying(false);
  };

  // 播放/暂停录音
  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // 上传录音
  const handleUpload = async () => {
    if (!audioFile) return;

    setIsUploading(true);
    try {
      await onUpload(audioFile);
      resetRecording();
    } catch (error) {
      console.error("上传失败:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          {t("onsite.audioMode")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 隐藏的文件输入，使用 capture 属性调用系统录音 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          capture="user"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 录音控制按钮 */}
        <div className="flex flex-col gap-3">
          {!audioFile && (
            <Button
              onClick={handleRecordClick}
              disabled={disabled}
              size="lg"
              className="w-full"
            >
              <Mic className="h-5 w-5 mr-2" />
              {t("onsite.startRecording")}
            </Button>
          )}

          {audioFile && (
            <>
              {/* 播放控制 */}
              <audio
                ref={audioRef}
                src={audioUrl || undefined}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />

              <div className="flex gap-2">
                <Button
                  onClick={togglePlayback}
                  size="lg"
                  variant="outline"
                  className="flex-1"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-5 w-5 mr-2" />
                      {t("onsite.pause")}
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2" />
                      {t("onsite.play")}
                    </>
                  )}
                </Button>

                <Button
                  onClick={resetRecording}
                  size="lg"
                  variant="outline"
                  disabled={isUploading}
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              </div>

              <Button
                onClick={handleUpload}
                disabled={isUploading}
                size="lg"
                className="w-full"
              >
                {isUploading ? (
                  t("onsite.uploading")
                ) : (
                  <>
                    <Upload className="h-5 w-5 mr-2" />
                    {t("onsite.confirmUpload")}
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        {/* 文件信息 */}
        {audioFile && (
          <div className="text-sm text-muted-foreground text-center space-y-1">
            <div>
              {t("onsite.fileName")}: {audioFile.name}
            </div>
            <div>
              {t("onsite.fileSize")}: {(audioFile.size / 1024).toFixed(2)} KB
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
