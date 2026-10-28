import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { getCloneableBody } from "next/dist/server/body-streams";
import nextConfig from "../next.config";
import { ContentError } from "../lib/content-model/errors";
import { inferUploadType } from "../lib/upload/detection";
import { getUploadSourceLimitBytes, MAX_MULTIPART_BYTES, STORED_FILE_MAX_BYTES } from "../lib/upload/policy";
import { readUploadForm } from "../lib/upload/request.server";

test("original media size policy is independent of the stored output limit", () => {
  for (const type of ["image", "anchor", "audio"] as const) assert.equal(getUploadSourceLimitBytes(type), 32 * 1024 * 1024);
  assert.equal(getUploadSourceLimitBytes("model"), 3 * 1024 * 1024);
  assert.equal(getUploadSourceLimitBytes("video"), 3 * 1024 * 1024);
  assert.equal(STORED_FILE_MAX_BYTES, 5 * 1024 * 1024);
  for (const extension of ["mp3", "wav", "m4a", "aac", "ogg", "opus", "flac", "aiff", "aif", "amr", "wma"]) {
    assert.equal(inferUploadType("application/octet-stream", `sound.${extension}`), "audio");
  }
  assert.equal(inferUploadType("audio/webm", "recording.webm"), "audio");
  assert.equal(inferUploadType("application/octet-stream", "movie.webm"), "video");
});

test("multipart parser preserves original bytes and rejects malformed input", async () => {
  const original = new Uint8Array([1, 2, 3]);
  const body = new FormData();
  body.set("file", new File([original], "input.wav", { type: "audio/wav" }));
  body.set("organization_id", "team");
  const parsed = await readUploadForm(new Request("http://localhost/api/upload", { method: "POST", body }));
  const file = parsed.get("file");
  assert.ok(file instanceof File);
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), original);
  assert.equal(parsed.get("organization_id"), "team");
  for (const headers of [{ "content-type": "application/json" }, { "content-type": "multipart/form-data; boundary=invalid" }]) {
    await assert.rejects(readUploadForm(new Request("http://localhost/api/upload", { method: "POST", headers, body: "invalid" })),
      (error: unknown) => error instanceof ContentError && error.status === 400);
  }
});

test("multipart limit rejects both declared and chunked oversized bodies before parsing", async () => {
  await assert.rejects(readUploadForm(new Request("http://localhost/api/upload", {
    method: "POST", headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(MAX_MULTIPART_BYTES + 1) }, body: "x",
  })), (error: unknown) => error instanceof ContentError && error.status === 413);
  let cancelled = false;
  let chunksRead = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { chunksRead++; controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { cancelled = true; },
  });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: stream, duplex: "half",
  };
  await assert.rejects(readUploadForm(new Request("http://localhost/api/upload", init)),
    (error: unknown) => error instanceof ContentError && error.status === 413);
  assert.equal(cancelled, true);
  assert.ok(chunksRead <= 35, "the reader stops rather than buffering the remaining stream");
});

test("an HTTP upload above 10 MiB survives the configured Next proxy body clone", async () => {
  // Exercise the installed Next transport, not just the route's FormData parser:
  // the old default would silently truncate originals before the route ran.
  const setting = nextConfig.experimental?.proxyClientMaxBodySize;
  assert.equal(typeof setting, "string");
  assert.match(String(setting), /^\d+mb$/);
  const limit = Number.parseInt(String(setting), 10) * 1024 * 1024;
  const server = createServer(async (incoming, response) => {
    try {
      const body = getCloneableBody(incoming, limit);
      for await (const chunk of body.cloneBodyStream()) void chunk;
      await body.finalize();
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const request = new Request("http://localhost/api/upload", {
        method: "POST", headers: { "content-type": incoming.headers["content-type"] ?? "" },
        body: Buffer.concat(chunks),
      });
      const form = await readUploadForm(request);
      const file = form.get("file");
      assert.ok(file instanceof File);
      const data = new Uint8Array(await file.arrayBuffer());
      response.end(JSON.stringify({ size: file.size, tail: data.at(-1) }));
    } catch (error) {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.message : "upload failed");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const bytes = new Uint8Array(12 * 1024 * 1024); bytes[bytes.length - 1] = 123;
    const form = new FormData(); form.set("file", new File([bytes], "original.wav", { type: "audio/wav" }));
    const response = await fetch(`http://127.0.0.1:${address.port}/api/upload`, { method: "POST", body: form });
    const result = await response.text();
    assert.equal(response.status, 200, result);
    assert.deepEqual(JSON.parse(result), { size: bytes.length, tail: 123 });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
