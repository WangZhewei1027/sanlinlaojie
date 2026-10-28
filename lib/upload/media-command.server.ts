import { spawn } from "node:child_process";
import { ContentError } from "@/lib/content-model/errors";
import "server-only";

/** Bounded local media processes. Never interpolate uploads into a shell. */
export function runMediaCommand(command: "ffmpeg" | "ffprobe", args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const stdout: Buffer[] = [];
    let outputBytes = 0;
    let stopped: ContentError | undefined;
    const stop = (message: string) => {
      stopped ??= new ContentError("VALIDATION_FAILED", message);
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => stop("音频处理超时，请使用更短的音频后重试"), command === "ffprobe" ? 15_000 : 60_000);
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > 128 * 1024) stop("音频数据异常，无法完成处理");
      else stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > 128 * 1024) stop("音频数据异常，无法完成处理");
    });
    child.once("error", () => {
      clearTimeout(timer);
      reject(new ContentError("INTERNAL", "音频处理服务暂不可用，请稍后重试", undefined, 503));
    });
    // Wait for close even after killing: the caller may now remove its temp files.
    child.once("close", (code) => {
      clearTimeout(timer);
      if (stopped) reject(stopped);
      else if (code !== 0) reject(new ContentError("VALIDATION_FAILED", "音频格式不支持、文件损坏或不含有效音轨"));
      else resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}
