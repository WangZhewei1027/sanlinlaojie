"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mic, Upload, RotateCcw, Play, Pause, StopCircle } from "lucide-react";

interface AudioRecorderProps {
  onUpload: (
    audioFile: File,
    title?: string,
    description?: string
  ) => Promise<void>;
  disabled?: boolean;
}

export function AudioRecorder({ onUpload, disabled }: AudioRecorderProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // 开始录音
  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 检查支持的 MIME 类型
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];

      let selectedMimeType = "";
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log("使用 MIME 类型:", mimeType);
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error(t("onsite.browserNotSupported"));
      }

      // 创建 MediaRecorder 并指定 MIME 类型
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log("录音数据块:", event.data.size, "bytes");
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("录音停止，总块数:", audioChunksRef.current.length);

        const audioBlob = new Blob(audioChunksRef.current, {
          type: selectedMimeType,
        });

        console.log("录音文件大小:", audioBlob.size, "bytes");

        const fileExt = selectedMimeType.includes("webm")
          ? "webm"
          : selectedMimeType.includes("ogg")
          ? "ogg"
          : "mp4";

        const file = new File(
          [audioBlob],
          `recording-${Date.now()}.${fileExt}`,
          {
            type: selectedMimeType,
          }
        );
        const url = URL.createObjectURL(audioBlob);

        setAudioFile(file);
        setAudioUrl(url);

        // 停止所有音轨
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(1000); // 每秒保存一次数据
      setIsRecording(true);
      setRecordingTime(0);

      console.log("开始录音，MIME 类型:", selectedMimeType);

      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("录音失败:", err);
      setError(t("onsite.microphoneError"));
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
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
    setRecordingTime(0);
    setError(null);
    setTitle("");
    setDescription("");
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
      await onUpload(audioFile, title || undefined, description || undefined);
      resetRecording();
    } catch (error) {
      console.error("上传失败:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // 清理
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          {t("onsite.audioMode")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 错误提示 */}
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {/* 录音状态显示 */}
        {isRecording && (
          <div className="flex flex-col items-center gap-4 p-6 bg-muted rounded-lg">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-16 h-16 bg-destructive/20 rounded-full animate-ping" />
              <div className="relative w-12 h-12 bg-destructive rounded-full flex items-center justify-center">
                <Mic className="h-6 w-6 text-destructive-foreground" />
              </div>
            </div>
            <div className="text-2xl font-mono font-bold">
              {formatTime(recordingTime)}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("onsite.recording")}
            </p>
          </div>
        )}

        {/* 录音控制按钮 */}
        <div className="flex flex-col gap-3">
          {!isRecording && !audioFile && (
            <Button
              onClick={startRecording}
              disabled={disabled}
              size="lg"
              className="w-full"
            >
              <Mic className="h-5 w-5 mr-2" />
              {t("onsite.startRecording")}
            </Button>
          )}

          {isRecording && (
            <Button
              onClick={stopRecording}
              size="lg"
              variant="destructive"
              className="w-full"
            >
              <StopCircle className="h-5 w-5 mr-2" />
              {t("onsite.stopRecording")}
            </Button>
          )}

          {!isRecording && audioFile && (
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

              {/* 标题和描述输入 */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="audio-title">{t("onsite.audioTitle")}</Label>
                  <Input
                    id="audio-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("onsite.audioTitlePlaceholder")}
                    disabled={isUploading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audio-description">
                    {t("onsite.audioDescription")}
                  </Label>
                  <Textarea
                    id="audio-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("onsite.audioDescriptionPlaceholder")}
                    disabled={isUploading}
                    rows={3}
                  />
                </div>
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
        {audioFile && !isRecording && (
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
