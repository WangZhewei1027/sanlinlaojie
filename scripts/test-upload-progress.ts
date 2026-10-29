import assert from "node:assert/strict";
import test from "node:test";
import type { UploadResponse } from "../lib/content-model/contracts";
import { readUploadEvents, type UploadStage } from "../lib/upload/progress";
import { uploadProgressResponse } from "../lib/upload/progress.server";
import { ContentApiError, uploadReceipt } from "../app/manage/lib/content-api";

const result: UploadResponse = {
  url: "https://media.invalid/test.mp4", contentHash: "hash", storagePath: "assets/test.mp4",
  data: { id: "receipt", organization_id: "team", workspace_id: null, storage_key: "assets/test.mp4", url: "https://media.invalid/test.mp4",
    content_hash: "hash", mime_type: "video/mp4", size_bytes: 1024, purpose: "asset", reused: false, expires_at: "2099-01-01T00:00:00Z" },
};
const failure = async () => Response.json({ code: "VALIDATION_FAILED", error: "视频文件损坏" }, { status: 400 });

test("compression stage reaches client before processing completes, then storage and receipt", async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const response = uploadProgressResponse(async report => {
    report("compressingVideo"); await pending; report("storing"); return result;
  }, failure);
  const events = readUploadEvents(response.body!);
  assert.deepEqual((await events.next()).value, { event: "stage", stage: "compressingVideo" });
  finish();
  assert.deepEqual((await events.next()).value, { event: "stage", stage: "storing" });
  assert.deepEqual((await events.next()).value, { event: "complete", response: result });
  assert.equal((await events.next()).done, true);
});

test("client receives real stages, handles split UTF-8/JSON, and returns final receipt", async () => {
  const original = globalThis.fetch;
  const stages: UploadStage[] = [];
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(new Headers(init?.headers).get("accept"), "application/x-ndjson");
      assert.ok(init?.body instanceof FormData);
      const bytes = new TextEncoder().encode(JSON.stringify({ event: "stage", stage: "compressingImage" }) + "\n" + JSON.stringify({ event: "complete", response: { ...result, url: "https://media.invalid/图片" } }) + "\n");
      return new Response(new ReadableStream({ start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      } }), { headers: { "Content-Type": "application/x-ndjson" } });
    };
    const receipt = await uploadReceipt(new File(["image"], "image.jpg"), { organizationId: "team", type: "image", onStage: stage => stages.push(stage) });
    assert.equal(receipt.id, result.data.id);
    assert.deepEqual(stages, ["uploading", "compressingImage"]);
  } finally { globalThis.fetch = original; }
});

test("post-header failures keep original API status/code, truncated streams never succeed", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => uploadProgressResponse(async report => { report("compressingVideo"); throw new Error("invalid video"); }, failure);
    await assert.rejects(uploadReceipt(new File(["broken"], "broken.mp4"), { organizationId: "team", type: "video" }),
      (error: unknown) => error instanceof ContentApiError && error.status === 400 && error.code === "VALIDATION_FAILED" && error.message === "视频文件损坏");
    globalThis.fetch = async () => new Response('{"event":"stage","stage":"storing"}\n', { headers: { "Content-Type": "application/x-ndjson" } });
    await assert.rejects(uploadReceipt(new File(["file"], "file.glb"), { organizationId: "team", type: "model" }),
      (error: unknown) => error instanceof ContentApiError && error.code === "RECEIPT_INVALID");
    globalThis.fetch = async () => Response.json(result);
    assert.equal((await uploadReceipt(new File(["file"], "file.glb"), { organizationId: "team", type: "model" })).id, "receipt", "older JSON servers remain compatible");
  } finally { globalThis.fetch = original; }
});

test("disconnect during compression does not break late server completion", async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  let completed = false;
  const response = uploadProgressResponse(async report => {
    report("compressingAudio"); await pending; report("storing"); completed = true; return result;
  }, failure);
  const reader = response.body!.getReader();
  await reader.read(); await reader.cancel(); finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, true);
});
