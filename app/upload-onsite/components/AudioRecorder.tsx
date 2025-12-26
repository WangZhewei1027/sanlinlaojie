"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Upload, RotateCcw, Play, Pause, StopCircle } from "lucide-react";

interface AudioRecorderProps {
  onUpload: (audioFile: File) => Promise<void>;
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // 绘制波形
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current || !isRecording) {
      return;
    }

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyser.getByteTimeDomainData(dataArray);

    // 清空画布
    canvasCtx.fillStyle = "rgb(0, 0, 0)";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制波形
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "rgb(239, 68, 68)"; // destructive color
    canvasCtx.beginPath();

    const sliceWidth = (canvas.width * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();

    // 继续下一帧
    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  };

  // 开始录音
  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 设置音频分析器
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const file = new File([audioBlob], `recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        const url = URL.createObjectURL(audioBlob);

        setAudioFile(file);
        setAudioUrl(url);

        // 停止所有音轨
        stream.getTracks().forEach((track) => track.stop());

        // 关闭音频上下文
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);

        // 停止波形动画
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      }, 1000);

      // 开始绘制波形
      drawWaveform();
    } catch (err) {
      console.error("录音失败:", err);
      setError("无法访问麦克风，请检查权限设置");
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

  // 清理
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
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

                {/* 波形显示 */}
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={100}
                  className="w-full max-w-sm h-24 rounded border border-border"
                />
              </div>
            </div>
            <div className="text-2xl font-mono font-bold">
              {formatTime(recordingTime)}
            </div>
            <p className="text-sm text-muted-foreground">录音中...</p>
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
              停止录音
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
