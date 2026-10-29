import { spawn } from "node:child_process";
import { ContentError } from "@/lib/content-model/errors";
import "server-only";

/** Bounded local media processes. Never interpolate uploads into a shell. */
export function runMediaCommand(command: "ffmpeg" | "ffprobe", args: string[], kind: "audio" | "video" = "audio"): Promise<string> {
  const label = kind === "video" ? "视频" : "音频";
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const stdout: Buffer[] = [];
    let outputBytes = 0;
    let stopped: ContentError | undefined;
    const stop = (message: string) => {
      stopped ??= new ContentError("VALIDATION_FAILED", message);
      child.kill("SIGKILL");
    };
    const timeoutMs = command === "ffprobe" ? (kind === "video" ? 30_000 : 15_000) : kind === "video" ? 300_000 : 60_000;
    const timer = setTimeout(() => stop(`${label}处理超时，请使用更短的${label}后重试`), timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > 128 * 1024) stop(`${label}数据异常，无法完成处理`);
      else stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > 128 * 1024) stop(`${label}数据异常，无法完成处理`);
    });
    child.once("error", () => {
      clearTimeout(timer);
      reject(new ContentError("INTERNAL", `${label}处理服务暂不可用，请稍后重试`, undefined, 503));
    });
    // Wait for close even after killing: the caller may now remove its temp files.
    child.once("close", (code) => {
      clearTimeout(timer);
      if (stopped) reject(stopped);
      else if (code !== 0) reject(new ContentError("VALIDATION_FAILED", `${label}格式不支持、文件损坏或不含有效${kind === "video" ? "画面" : "音轨"}`));
      else resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}
