import type { ApiErrorBody, UploadResponse } from "@/lib/content-model/contracts";

/** Stage changes describe completed boundaries, never estimated timers. */
export const SERVER_UPLOAD_STAGES = ["preparing", "compressingImage", "compressingAudio", "compressingVideo", "storing"] as const;
export type ServerUploadStage = (typeof SERVER_UPLOAD_STAGES)[number];
export type UploadStage = ServerUploadStage | "uploading" | "creating";
export type UploadStageListener = (stage: UploadStage) => void;
export const UPLOAD_STREAM_CONTENT_TYPE = "application/x-ndjson";
export type UploadEvent =
  | { event: "stage"; stage: ServerUploadStage }
  | { event: "complete"; response: UploadResponse }
  | { event: "error"; status: number; body: ApiErrorBody };

/** Decode incrementally: network chunks need not end on a JSON/UTF-8 boundary. */
export async function* readUploadEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<UploadEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      if (pending.length > 128 * 1024) throw new Error("Upload progress response too large");
      const lines = pending.split("\n");
      pending = lines.pop()!;
      if (done && pending) { lines.push(pending); pending = ""; }
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as UploadEvent;
        if (!event || !["stage", "complete", "error"].includes(event.event)) throw new Error("Invalid upload progress response");
        if (event.event === "stage" && !SERVER_UPLOAD_STAGES.includes(event.stage)) throw new Error("Invalid upload stage");
        yield event;
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
