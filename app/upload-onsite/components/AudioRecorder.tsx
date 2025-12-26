"use client";

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Square, Upload, RotateCcw, Play, Pause } from "lucide-react";

interface AudioRecorderProps {
  onUpload: (audioFile: File) => Promise<void>;
  disabled?: boolean;
}

export function AudioRecorder({ onUpload, disabled }: AudioRecorderProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 使用 Opus 编码的 WebM 格式（与 audio-compression.ts 保持一致）
      const mimeType = "audio/webm;codecs=opus";
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 64000, // 64kbps 适合语音
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));

        // 停止所有音频轨道
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("无法访问麦克风:", error);
      alert(t("onsite.microphoneError") || "无法访问麦克风，请检查权限设置");
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
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
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
    if (!audioBlob) return;

    setIsUploading(true);
    try {
      const fileName = `recording-${Date.now()}.webm`;
      const file = new File([audioBlob], fileName, {
        type: "audio/webm;codecs=opus",
      });

      await onUpload(file);
      resetRecording();
    } catch (error) {
      console.error("上传失败:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
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
        {/* 录音时间显示 */}
        <div className="text-center">
          <div className="text-3xl font-mono font-bold">
            {formatTime(recordingTime)}
          </div>
          {isRecording && (
            <div className="text-sm text-muted-foreground animate-pulse mt-2">
              {t("onsite.recording")}
            </div>
          )}
        </div>

        {/* 录音控制按钮 */}
        <div className="flex flex-col gap-3">
          {!audioBlob && !isRecording && (
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
              <Square className="h-5 w-5 mr-2" />
              {t("onsite.stopRecording")}
            </Button>
          )}

          {audioBlob && (
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
        {audioBlob && (
          <div className="text-sm text-muted-foreground text-center">
            {t("onsite.fileSize")}: {(audioBlob.size / 1024).toFixed(2)} KB
          </div>
        )}
      </CardContent>
    </Card>
  );
}
