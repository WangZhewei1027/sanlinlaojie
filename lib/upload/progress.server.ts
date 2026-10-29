import "server-only";
import type { UploadResponse, ApiErrorBody } from "@/lib/content-model/contracts";
import { UPLOAD_STREAM_CONTENT_TYPE, type ServerUploadStage, type UploadEvent } from "./progress";

/** Only start after authentication, bounded multipart parsing and scope checks. */
export function uploadProgressResponse(
  run: (report: (stage: ServerUploadStage) => void) => Promise<UploadResponse>,
  onError: (error: unknown) => Promise<Response>,
): Response {
  let closed = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: UploadEvent) => {
        if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        emit({ event: "complete", response: await run(stage => emit({ event: "stage", stage })) });
      } catch (error) {
        const response = await onError(error);
        emit({ event: "error", status: response.status, body: await response.json() as ApiErrorBody });
      } finally {
        if (!closed) { closed = true; controller.close(); }
      }
    },
    // Work already accepted by the server finishes safely under its receipt
    // lease; disconnecting must not throw when a late stage is emitted.
    cancel() { closed = true; },
  });
  return new Response(stream, { headers: {
    "Content-Type": `${UPLOAD_STREAM_CONTENT_TYPE}; charset=utf-8`,
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  } });
}
