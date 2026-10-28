import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { ContentError } from "../lib/content-model/errors";
import { processUploadMedia } from "../lib/upload/media-processing.server";

const file = (buffer: Uint8Array, name: string, type: string) => new File([Uint8Array.from(buffer)], name, { type });
const invalid = (status = 400) => (error: unknown) => error instanceof ContentError && error.status === status;

function wav(seconds: number, channels = 1, sampleRate = 44100): Buffer {
  const frames = Math.floor(seconds * sampleRate), dataBytes = frames * channels * 2;
  const result = Buffer.alloc(44 + dataBytes);
  result.write("RIFF"); result.writeUInt32LE(36 + dataBytes, 4); result.write("WAVEfmt ", 8);
  result.writeUInt32LE(16, 16); result.writeUInt16LE(1, 20); result.writeUInt16LE(channels, 22);
  result.writeUInt32LE(sampleRate, 24); result.writeUInt32LE(sampleRate * channels * 2, 28);
  result.writeUInt16LE(channels * 2, 32); result.writeUInt16LE(16, 34); result.write("data", 36); result.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < frames; i++) for (let channel = 0; channel < channels; channel++)
    result.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * (440 + channel * 110) / sampleRate) * 10000), 44 + (i * channels + channel) * 2);
  return result;
}

test("server audio conversion makes deterministic 32 kbps mono MP3 and preserves duration", async () => {
  const source = wav(2);
  const input = file(source, "voice.WAV", "audio/wav");
  const first = await processUploadMedia(input, "audio");
  const second = await processUploadMedia(input, "audio");
  assert.equal(first.fileName, "voice.mp3"); assert.equal(first.mimeType, "audio/mpeg");
  assert.ok(first.buffer.length < source.length / 5);
  assert.deepEqual(first.buffer, second.buffer, "dedup hashes are based on reproducible final bytes");
  const directory = await mkdtemp(join(tmpdir(), "upload-media-test-"));
  try {
    const output = join(directory, "result.mp3"); await writeFile(output, first.buffer);
    const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", output], { encoding: "utf8" }));
    assert.equal(info.streams[0].codec_name, "mp3"); assert.equal(info.streams[0].bit_rate, "32000");
    assert.equal(info.streams[0].sample_rate, "24000"); assert.equal(info.streams[0].channels, 1);
    const decoded = execFileSync("ffmpeg", ["-v", "error", "-i", output, "-f", "s16le", "-acodec", "pcm_s16le", "pipe:1"], { maxBuffer: 1024 * 1024 });
    assert.equal(decoded.length / 2 / 24000, 2, "MP3 encoder padding is compensated and the full recording survives");
    assert.equal(info.format.tags, undefined, "private source metadata is not retained");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("AAC/M4A and Opus/WebM inputs normalize to the same mono MP3 contract from stereo inputs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "upload-media-test-"));
  try {
    const input = join(directory, "input.wav"); await writeFile(input, wav(0.5, 2));
    for (const [extension, encoder, mime] of [["m4a", "aac", "audio/mp4"], ["webm", "libopus", "audio/webm"]]) {
      const encoded = join(directory, `source.${extension}`);
      execFileSync("ffmpeg", ["-v", "error", "-i", input, "-c:a", encoder, "-metadata", "title=private title", encoded]);
      const normalized = await processUploadMedia(file(await readFile(encoded), `source.${extension}`, mime), "audio");
      const output = join(directory, `${extension}.mp3`); await writeFile(output, normalized.buffer);
      const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", output], { encoding: "utf8" }));
      assert.equal(normalized.mimeType, "audio/mpeg"); assert.equal(info.streams[0].channels, 1);
      assert.ok(Math.abs(Number(info.streams[0].duration) - 0.5) < 0.1);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("invalid audio, playlists and overlong audio fail without leaving processing files", async () => {
  const before = (await readdir(tmpdir())).filter(name => name.startsWith(`sanlin-upload-${process.pid}-`)).sort();
  await assert.rejects(processUploadMedia(file(Buffer.from("not audio"), "broken.mp3", "audio/mpeg"), "audio"), invalid());
  await assert.rejects(processUploadMedia(file(Buffer.from("#EXTM3U\n#EXTINF:5,\nhttp://127.0.0.1/private.wav\n"), "list.mp3", "audio/mpeg"), "audio"), invalid());
  await assert.rejects(processUploadMedia(file(wav(601, 1, 8000), "long.wav", "audio/wav"), "audio"), invalid(413));
  assert.deepEqual((await readdir(tmpdir())).filter(name => name.startsWith(`sanlin-upload-${process.pid}-`)).sort(), before);
});

test("streamed MediaRecorder-style WebM without Duration transcodes fully and still enforces ten minutes", async () => {
  const before = (await readdir(tmpdir())).filter(name => name.startsWith(`sanlin-upload-${process.pid}-`)).sort();
  const streamedWebm = (seconds: number) => execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `anullsrc=r=8000:cl=mono:d=${seconds}`,
    "-c:a", "libopus", "-b:a", "6k", "-f", "webm", "pipe:1"], { maxBuffer: 16 * 1024 * 1024 });
  const directory = await mkdtemp(join(tmpdir(), "upload-media-test-"));
  try {
    const source = streamedWebm(0.5), input = join(directory, "streamed.webm");
    await writeFile(input, source);
    const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=duration:format=duration", "-of", "json", input], { encoding: "utf8" }));
    assert.equal(info.streams[0].duration, undefined); assert.equal(info.format.duration, undefined);
    const normalized = await processUploadMedia(file(source, "recording.webm", "audio/webm;codecs=opus"), "audio");
    assert.equal(normalized.mimeType, "audio/mpeg");
    const output = join(directory, "result.mp3"); await writeFile(output, normalized.buffer);
    const decoded = execFileSync("ffmpeg", ["-v", "error", "-i", output, "-f", "s16le", "-acodec", "pcm_s16le", "pipe:1"], { maxBuffer: 1024 * 1024 });
    assert.equal(decoded.length / 2 / 24000, 0.5, "the entire recording survives even without source duration metadata");
    const tooLong = streamedWebm(601);
    await assert.rejects(processUploadMedia(file(tooLong, "long-recording.webm", "audio/webm"), "audio"),
      (error: unknown) => invalid(413)(error) && error instanceof Error && error.message.includes("10 分钟"));
  } finally { await rm(directory, { recursive: true, force: true }); }
  assert.deepEqual((await readdir(tmpdir())).filter(name => name.startsWith(`sanlin-upload-${process.pid}-`)).sort(), before);
});

test("photos compress on the server, are correctly oriented and lose EXIF metadata", async () => {
  const width = 2100, height = 1400, pixels = Buffer.alloc(width * height * 3);
  let seed = 1;
  for (let i = 0; i < pixels.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels[i] = seed >>> 24; }
  const source = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const normalized = await processUploadMedia(file(source, "photo.png", "image/png"), "image");
  assert.equal(normalized.mimeType, "image/jpeg"); assert.equal(normalized.fileName, "photo.jpg");
  assert.ok(normalized.buffer.length <= 80 * 1024);
  const metadata = await sharp(normalized.buffer).metadata();
  assert.ok(metadata.width! <= 1024 && metadata.height! <= 1024);
  const anchor = await processUploadMedia(file(source, "anchor.png", "image/png"), "anchor");
  assert.ok(anchor.buffer.length <= 256 * 1024 && anchor.buffer.length > normalized.buffer.length, "reference images keep a larger quality budget than display images");
  const anchorInfo = await sharp(anchor.buffer).metadata();
  assert.ok(anchorInfo.width! <= 1280 && anchorInfo.height! <= 1280);
  const portrait = await sharp({ create: { width: 80, height: 40, channels: 3, background: "red" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const rotated = await processUploadMedia(file(portrait, "portrait.jpeg", "image/jpeg"), "image");
  const rotatedInfo = await sharp(rotated.buffer).metadata();
  assert.equal(rotatedInfo.width, 40); assert.equal(rotatedInfo.height, 80);
  assert.equal(rotatedInfo.orientation, undefined); assert.equal(rotatedInfo.exif, undefined);
  assert.deepEqual((await processUploadMedia(file(portrait, "portrait.jpeg", "image/jpeg"), "image")).buffer, rotated.buffer);
});

test("transparent images keep alpha, anchors use server validation and small images are not enlarged", async () => {
  const rgba = Buffer.from([255, 0, 0, 0, 0, 255, 0, 128, 0, 0, 255, 255, 255, 255, 255, 255]);
  const source = await sharp(rgba, { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer();
  const normalized = await processUploadMedia(file(source, "label.png", "image/png"), "image");
  assert.equal(normalized.mimeType, "image/png");
  const decoded = await sharp(normalized.buffer).raw().toBuffer({ resolveWithObject: true });
  assert.equal(decoded.info.width, 2); assert.equal(decoded.info.height, 2);
  assert.equal(decoded.data[3], 0); assert.equal(decoded.data[7], 128); assert.equal(decoded.data[11], 255);
  // A many-colour soft edge catches palette optimizations that preserve a few
  // test pixels but quantize real semi-transparent artwork.
  const gradient = Buffer.alloc(256 * 16 * 4);
  for (let i = 0; i < gradient.length; i += 4) {
    gradient[i] = (i / 4) % 256; gradient[i + 1] = Math.floor(i / 1024) * 16;
    gradient[i + 2] = 255 - gradient[i]; gradient[i + 3] = (i / 4) % 256;
  }
  const gradientPng = await sharp(gradient, { raw: { width: 256, height: 16, channels: 4 } }).png().toBuffer();
  const preserved = await processUploadMedia(file(gradientPng, "edge.png", "image/png"), "image");
  const preservedPixels = await sharp(preserved.buffer).ensureAlpha().raw().toBuffer();
  for (let i = 3; i < gradient.length; i += 4) assert.equal(preservedPixels[i], gradient[i], "PNG keeps every alpha value without resizing");
  assert.ok((await processUploadMedia(file(source, "anchor.png", "image/png"), "anchor")).buffer.length < 1024 * 1024);
  await assert.rejects(processUploadMedia(file(Buffer.from("broken"), "photo.jpg", "image/jpeg"), "image"), invalid());
  await assert.rejects(processUploadMedia(file(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'), "photo.svg", "image/svg+xml"), "image"), invalid());
  const gif = await sharp(source).gif().toBuffer();
  await assert.rejects(processUploadMedia(file(gif, "fake.png", "image/png"), "anchor"), invalid());
  // A valid PNG header claiming 64 MP must be rejected before pixel allocation.
  const oversized = Buffer.from(source);
  oversized.writeUInt32BE(8000, 16); oversized.writeUInt32BE(8000, 20);
  let crc = 0xffffffff;
  for (const byte of oversized.subarray(12, 29)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  oversized.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 29);
  await assert.rejects(processUploadMedia(file(oversized, "huge.png", "image/png"), "image"), invalid());
});

test("concurrent media uploads are bounded and the slot is released after a failure", async () => {
  const input = file(wav(1), "voice.wav", "audio/wav");
  const results = await Promise.allSettled([processUploadMedia(input, "audio"), processUploadMedia(input, "audio"), processUploadMedia(input, "audio")]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 2);
  const rejected = results.find(result => result.status === "rejected");
  assert.ok(rejected?.status === "rejected" && invalid(429)(rejected.reason));
  const raw = Buffer.from("model data");
  assert.deepEqual((await processUploadMedia(file(raw, "model.glb", "model/gltf-binary"), "model")).buffer, raw);
  assert.equal((await processUploadMedia(input, "audio")).mimeType, "audio/mpeg");
});
