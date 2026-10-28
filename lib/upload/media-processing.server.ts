import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { ContentError } from "@/lib/content-model/errors";
import { MAX_MATCH_IMAGE_BYTES } from "@/lib/anchor-matching";
import { runMediaCommand } from "./media-command.server";
import { STORED_FILE_MAX_BYTES } from "./policy";
import type { UploadType } from "./types";
import "server-only";

const MAX_AUDIO_SECONDS = 600;
const IMAGE_PROFILES = {
  image: { targetBytes: 80 * 1024, steps: [[1024, 50], [768, 40]] },
  anchor: { targetBytes: 256 * 1024, steps: [[1280, 65], [1024, 50]] },
} as const;
const IMAGE_OPTIONS = { limitInputPixels: 60_000_000, failOn: "warning", animated: false } as const;
// Exclude playlists, devices and protocols which could follow attacker-controlled
// URLs or paths. MOV external data references remain disabled by FFmpeg's default.
const AUDIO_INPUT_OPTIONS = ["-protocol_whitelist", "file", "-format_whitelist", "mp3,wav,flac,ogg,aac,mov,matroska,webm,amr,aiff,asf,caf"];
let activeJobs = 0;

export interface ProcessedUploadMedia {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

function outputName(name: string, extension: string): string {
  return `${name.replace(/\.[^.]*$/, "") || "media"}.${extension}`;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

async function audioInfo(path: string): Promise<{ duration: number | null; channels: number }> {
  const output = await runMediaCommand("ffprobe", ["-v", "error", ...AUDIO_INPUT_OPTIONS, "-select_streams", "a:0",
    "-show_entries", "stream=channels,duration:format=duration", "-of", "json", path]);
  let data: unknown;
  try { data = JSON.parse(output); } catch { throw new ContentError("VALIDATION_FAILED", "无法读取音频信息"); }
  const info = record(data);
  const stream = Array.isArray(info?.streams) ? record(info.streams[0]) : undefined;
  // MediaRecorder's non-seekable WebM commonly has no Duration element.
  // Unknown source duration is acceptable; the completed MP3 must have one.
  const duration = [stream?.duration, record(info?.format)?.duration]
    .map(Number).find(value => Number.isFinite(value) && value > 0) ?? null;
  const channels = stream?.channels;
  if (!stream || typeof channels !== "number" || !Number.isInteger(channels) || channels < 1)
    throw new ContentError("VALIDATION_FAILED", "音频不含有效音轨");
  return { duration, channels };
}

async function transcodeAudio(buffer: Buffer, name: string): Promise<ProcessedUploadMedia> {
  const directory = await mkdtemp(join(tmpdir(), `sanlin-upload-${process.pid}-`));
  try {
    const input = join(directory, "input");
    const output = join(directory, "output.mp3");
    await writeFile(input, buffer);
    const source = await audioInfo(input);
    if (source.duration !== null && source.duration > MAX_AUDIO_SECONDS)
      throw new ContentError("VALIDATION_FAILED", "音频时长不能超过 10 分钟", undefined, 413);
    await runMediaCommand("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-xerror",
      ...AUDIO_INPUT_OPTIONS, "-err_detect", "explode", "-threads", "1", "-i", input,
      "-map", "0:a:0", "-vn", "-sn", "-dn", "-map_metadata", "-1", "-map_chapters", "-1",
      "-c:a", "libmp3lame", "-b:a", "32k", "-ar", "24000", "-ac", "1", "-compression_level", "7",
      // Unknown-duration recordings stop just past the limit and are rejected
      // below, instead of spending CPU on the entire overlong source.
      "-t", String(MAX_AUDIO_SECONDS + 1),
      "-threads", "1", "-id3v2_version", "0", "-write_id3v1", "0", "-fs", String(STORED_FILE_MAX_BYTES), output]);
    const size = (await stat(output)).size;
    if (size === 0 || size > STORED_FILE_MAX_BYTES)
      throw new ContentError("VALIDATION_FAILED", "处理后的音频超过 5 MiB，请缩短音频后重试", undefined, 413);
    // Do not silently accept a source whose misleading metadata hid a longer
    // recording. The small allowance is one MP3 encoder delay/padding interval.
    const result = await audioInfo(output);
    if (result.duration === null)
      throw new ContentError("VALIDATION_FAILED", "无法读取处理后的音频时长");
    if (result.duration > MAX_AUDIO_SECONDS + 0.1)
      throw new ContentError("VALIDATION_FAILED", "音频时长不能超过 10 分钟", undefined, 413);
    return { buffer: await readFile(output), fileName: outputName(name, "mp3"), mimeType: "audio/mpeg" };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function compressImage(buffer: Buffer, name: string, anchor: boolean): Promise<ProcessedUploadMedia> {
  try {
    const metadata = await sharp(buffer, IMAGE_OPTIONS).metadata();
    if (anchor && !["jpeg", "png", "webp"].includes(metadata.format ?? ""))
      throw new ContentError("VALIDATION_FAILED", "匹配图仅支持 JPEG、PNG 和 WebP");
    // SVG is deliberately not a raster upload: it can contain external sources.
    if (!["jpeg", "png", "webp", "gif", "tiff", "heif", "avif"].includes(metadata.format ?? ""))
      throw new ContentError("VALIDATION_FAILED", "不支持此图片格式，请上传 JPEG、PNG 或 WebP 图片");
    const alpha = metadata.hasAlpha === true;
    const profile = IMAGE_PROFILES[anchor ? "anchor" : "image"];
    const maxBytes = anchor ? MAX_MATCH_IMAGE_BYTES : STORED_FILE_MAX_BYTES;
    let best: Buffer | undefined;
    // At most two encodes. Shrink early instead of repeatedly re-encoding a
    // large image at progressively lower quality (previously up to 12 times).
    for (const [side, quality] of profile.steps) {
      const pipeline = sharp(buffer, IMAGE_OPTIONS).autoOrient()
        .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true }).timeout({ seconds: 10 });
      // Keep alpha values after resizing; palette quantization can damage soft
      // edges. Lower zlib effort spends less CPU while retaining PNG support.
      const candidate = await (alpha ? pipeline.png({ compressionLevel: 3 }) : pipeline.jpeg({ quality })).toBuffer();
      if (!best || candidate.length < best.length) best = candidate;
      if (candidate.length <= profile.targetBytes) return { buffer: candidate, fileName: outputName(name, alpha ? "png" : "jpg"), mimeType: alpha ? "image/png" : "image/jpeg" };
    }
    if (!best || best.length > maxBytes)
      throw new ContentError("VALIDATION_FAILED", `处理后的图片超过 ${maxBytes / 1024 / 1024} MiB，请降低图片分辨率后重试`, undefined, 413);
    return { buffer: best, fileName: outputName(name, alpha ? "png" : "jpg"), mimeType: alpha ? "image/png" : "image/jpeg" };
  } catch (error) {
    if (error instanceof ContentError) throw error;
    throw new ContentError("VALIDATION_FAILED", "图片格式不支持、文件损坏或超过 6000 万像素限制");
  }
}

/** Receipts and hashes must describe these final bytes, never the source file. */
export async function processUploadMedia(file: File, type: UploadType): Promise<ProcessedUploadMedia> {
  if (!["audio", "image", "anchor"].includes(type))
    return { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name, mimeType: file.type || "application/octet-stream" };
  if (activeJobs >= 2) throw new ContentError("VALIDATION_FAILED", "文件处理繁忙，请稍后重试", undefined, 429);
  activeJobs++;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    return type === "audio" ? await transcodeAudio(buffer, file.name) : await compressImage(buffer, file.name, type === "anchor");
  } finally {
    activeJobs--;
  }
}
