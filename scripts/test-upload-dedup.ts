/**
 * Upload dedup regression under the managed-receipt contract, run in-process
 * against the isolated validation database with the in-memory OSS double.
 * Fails closed: it never loads .env, never talks to a dev server, and refuses
 * to run unless DATABASE_URL names a dedicated 55439 database and the storage
 * module resolved to the double (scripts/test-support/install-route-stubs.ts).
 *
 *   DATABASE_URL=postgres://postgres:…@127.0.0.1:55439/team_wb_services \
 *     npx tsx --conditions react-server scripts/test-upload-dedup.ts
 *
 * (The former version signed up through localhost:3000 and could fall through
 * to a real OSS upload; it must not be revived.)
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { openAsBlob } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readUploadEvents } from "../lib/upload/progress";
import { createHash } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { processUploadMedia } from "../lib/upload/media-processing.server";
import { installRouteStubs } from "./test-support/install-route-stubs";
import type * as AuthStub from "./test-support/stub-auth-server";
import type * as OssStub from "./test-support/stub-oss";
import { assertServicesDatabase, cleanupServicesFixture, fixtureIds, seedServicesFixture } from "./test-content-model-services-fixture";

type Body = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function main(): Promise<void> {
  assertServicesDatabase();
  await installRouteStubs();
  const auth = (await import("../lib/auth/server")) as unknown as typeof AuthStub;
  const oss = (await import("../lib/storage/oss")) as unknown as typeof OssStub;
  assert.equal(typeof auth.setStubSessionUser, "function", "refusing to run: the session module is not the test double");
  assert.ok(oss.stubObjects instanceof Map, "refusing to run: object storage is not the in-memory double");
  for (const name of ["OSS_BUCKET", "OSS_REGION", "ALIBABA_CLOUD_ACCESS_KEY_ID", "ALIBABA_CLOUD_ACCESS_KEY_SECRET"]) assert.equal(process.env[name], undefined);

  const client = new Client({ connectionString: process.env.DATABASE_URL, application_name: "upload-dedup-regression" });
  await client.connect();
  const { db } = await import("../lib/db");
  const upload = (await import("../app/api/upload/route")).POST;
  const createAsset = (await import("../app/api/organizations/[id]/assets/route")).POST;
  const byHash = (await import("../app/api/assets/by-hash/route")).GET;
  const f = fixtureIds();

  type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
  const call = async (user: string | null, handler: unknown, url: string, init: RequestInit = {}, params?: Record<string, string>) => {
    auth.setStubSessionUser(user ? { id: user, email: null, name: null, emailVerified: true } : null);
    const response = await (handler as Handler)(new Request(`http://localhost${url}`, init), { params: Promise.resolve(params ?? {}) });
    if (response.headers.get("content-type")?.includes("application/x-ndjson")) {
      const stages: string[] = [];
      for await (const event of readUploadEvents(response.body!)) {
        if (event.event === "stage") stages.push(event.stage);
        else if (event.event === "error") return { status: event.status, body: event.body as Body, stages };
        else return { status: response.status, body: event.response as unknown as Body, stages };
      }
      throw new Error("Upload progress ended without a terminal result");
    }
    return { status: response.status, body: (await response.json()) as Body, stages: [] as string[] };
  };
  const bytes = Buffer.from(`glTF-dedup-${f.run}`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const send = (user: string | null, fields: Record<string, string>) => {
    const form = new FormData();
    form.set("file", new File([bytes], "box.glb", { type: "model/gltf-binary" }));
    form.set("type", "model");
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    return call(user, upload, "/api/upload", { method: "POST", body: form });
  };
  const sendMedia = (user: string | null, file: File, type?: string, stream = false) => {
    const form = new FormData();
    form.set("file", file);
    form.set("organization_id", f.organizations.team);
    if (type) form.set("type", type);
    return call(user, upload, "/api/upload", { method: "POST", body: form, ...(stream ? { headers: { Accept: "application/x-ndjson" } } : {}) });
  };

  try {
    await seedServicesFixture(client, f);
    const team = f.organizations.team;
    const first = await send(f.users.unassigned, { organization_id: team, workspace_id: f.workspaces.a });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.ok(first.body.storagePath && oss.stubObjects.has(first.body.storagePath));
    const committed = await call(f.users.unassigned, createAsset, `/api/organizations/${team}/assets`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "dedup box", fileType: "model", payload: { kind: "model" }, resources: [{ role: "primary", receiptId: first.body.data.id }], idempotencyKey: `${f.run}-dedup` }),
    }, { id: team });
    assert.equal(committed.status, 201, JSON.stringify(committed.body));
    const written = oss.stubObjects.size;

    const sameTeam: Record<string, string>[] = [{ organization_id: team, workspace_id: f.workspaces.b }, { workspace_id: f.workspaces.secret }, { organization_id: team }];
    for (const fields of sameTeam) {
      const again = await send(f.users.editor, fields);
      assert.equal(again.status, 200, JSON.stringify(again.body));
      assert.equal(again.body.storagePath, null, "identical bytes are reused anywhere in the same team");
      assert.equal(again.body.url, first.body.url);
      assert.equal(again.body.data.reused, true);
      assert.equal(again.body.data.organization_id, team);
    }
    assert.equal(oss.stubObjects.size, written, "reuse never writes a new object");

    const other = await send(f.users.foreign, { organization_id: f.organizations.foreign });
    assert.equal(other.status, 200, JSON.stringify(other.body));
    assert.ok(other.body.storagePath && other.body.storagePath !== first.body.storagePath, "dedup never crosses teams");
    assert.equal(other.body.data.reused, false);
    assert.equal((await send(f.users.foreign, { workspace_id: f.workspaces.b })).status, 404, "another team's collection looks missing");
    assert.equal((await send(f.users.foreign, { organization_id: team })).status, 403);
    assert.equal((await send(f.users.viewer, { organization_id: team })).status, 403, "viewers cannot upload");
    assert.equal((await send(null, { organization_id: team })).status, 401);

    const probe = (user: string, org: string) => call(user, byHash, `/api/assets/by-hash?hash=${hash}&organization_id=${org}`);
    assert.equal((await probe(f.users.editor, team)).body.file_url, first.body.url, "team members find committed team files by hash");
    const outsider = await probe(f.users.foreign, f.organizations.solo);
    assert.equal(outsider.status, 403, "a non-member cannot probe another team");
    console.log("PASS same-team reuse across collections and organization-only uploads, no cross-team reuse, denial for outsiders/viewers/anonymous");

    // > 10 MiB original exercises the new source limit independently of the
    // 5 MiB stored-file cap. The stream is valid PCM and shorter than 10 min.
    const samples = 44100 * 130;
    const wav = Buffer.alloc(44 + samples * 2);
    wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
    const audio = new File([Uint8Array.from(wav)], "original.wav", { type: "audio/wav" });
    const normalized = await processUploadMedia(audio, "audio");
    const converted = await sendMedia(f.users.editor, audio); // omitted type still normalizes audio
    assert.equal(converted.status, 200, JSON.stringify(converted.body));
    assert.match(converted.body.data.storage_key, /\.mp3$/);
    assert.equal(converted.body.data.mime_type, "audio/mpeg");
    assert.equal(converted.body.data.size_bytes, normalized.buffer.length);
    assert.equal(converted.body.contentHash, createHash("sha256").update(normalized.buffer).digest("hex"));
    assert.notEqual(converted.body.contentHash, createHash("sha256").update(wav).digest("hex"));
    const repeated = await sendMedia(f.users.editor, audio, "audio");
    assert.equal(repeated.status, 200, JSON.stringify(repeated.body));
    assert.equal(repeated.body.storagePath, null, "audio dedup hashes the deterministic final MP3");
    assert.equal(repeated.body.url, converted.body.url);

    const png = await sharp({ create: { width: 2500, height: 2000, channels: 3, background: "#ac5390" } }).png().toBuffer();
    const image = await sendMedia(f.users.editor, new File([Uint8Array.from(png)], "photo.png", { type: "image/png" }), "image");
    assert.equal(image.status, 200, JSON.stringify(image.body));
    assert.equal(image.body.data.mime_type, "image/jpeg");
    assert.match(image.body.data.storage_key, /\.jpe?g$/);
    assert.equal(oss.stubObjects.get(image.body.data.storage_key)?.contentType, "image/jpeg");
    const beforeFailure = oss.stubObjects.size;
    const corrupt = new File(["not audio"], "broken.wav", { type: "audio/wav" });
    assert.equal((await sendMedia(f.users.viewer, corrupt, "audio")).status, 403, "authorize before native processing");
    assert.equal((await sendMedia(f.users.editor, corrupt, "audio")).status, 400);
    assert.equal((await sendMedia(f.users.editor, audio, "document")).status, 400, "media cannot opt out via a generic type");
    assert.equal(oss.stubObjects.size, beforeFailure, "failed processing never writes an original or issues a usable object");
    console.log("PASS >10 MiB originals, server MP3/JPEG receipts, processed-byte dedup and failed-upload isolation");
    // Real route, processor, object double and receipts through the stream contract.
    const videoBytes = execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=128x72:rate=12:duration=0.5", "-c:v", "libvpx", "-f", "webm", "pipe:1"]);
    const video = new File([Uint8Array.from(videoBytes)], "clip.webm", { type: "video/webm" });
    const streamed = await sendMedia(f.users.editor, video, "video", true);
    assert.equal(streamed.status, 200, JSON.stringify(streamed.body));
    assert.deepEqual(streamed.stages, ["compressingVideo", "storing"]);
    assert.equal(streamed.body.data.mime_type, "video/mp4");
    assert.match(streamed.body.data.storage_key, /\.mp4$/);
    assert.equal(oss.stubObjects.get(streamed.body.data.storage_key)?.contentType, "video/mp4");
    const againVideo = await sendMedia(f.users.editor, video, "video", true);
    assert.equal(againVideo.body.storagePath, null);
    assert.equal(againVideo.body.url, streamed.body.url);
    const brokenStream = await sendMedia(f.users.editor, corrupt, "audio", true);
    assert.equal(brokenStream.status, 400);
    assert.deepEqual(brokenStream.stages, ["compressingAudio"]);
    assert.equal((await sendMedia(f.users.editor, video, "document", true)).status, 400);
    const forbiddenStream = await sendMedia(f.users.viewer, video, "video", true);
    assert.equal(forbiddenStream.status, 403);
    assert.deepEqual(forbiddenStream.stages, [], "authorization precedes streaming and compression");
    console.log("PASS streamed compression/storage stages, MP4 receipts/dedup and stream error status/auth guards");
    const videoDirectory = await mkdtemp(join(tmpdir(), "upload-route-video-"));
    try {
      const input = join(videoDirectory, "five-minutes.mp4");
      execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=300",
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=24000:duration=300",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", "-c:a", "aac", "-b:a", "64k", input]);
      const longVideo = new File([await openAsBlob(input)], "five-minutes.mp4", { type: "video/mp4" });
      const delivered = await sendMedia(f.users.editor, longVideo, "video", true);
      assert.equal(delivered.status, 200, JSON.stringify(delivered.body));
      assert.deepEqual(delivered.stages, ["compressingVideo", "storing"]);
      assert.ok(delivered.body.data.size_bytes > 5 * 1024 * 1024, "a valid low-bitrate video is not rejected by the non-video 5 MiB limit");
      assert.equal(oss.stubObjects.get(delivered.body.data.storage_key)?.size, delivered.body.data.size_bytes);
      console.log("PASS five-minute video above 5 MiB reaches storage and receives its complete upload receipt");
    } finally { await rm(videoDirectory, { recursive: true, force: true }); }
  } finally {
    try {
      await client.query("delete from error_log where user_id=any($1::uuid[])", [Object.values(f.users)]);
      await cleanupServicesFixture(client, f);
    } finally {
      auth.setStubSessionUser(null);
      await Promise.all([client.end(), db.destroy()]);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URL redacted]") : "Upload dedup regression failed");
  process.exitCode = 1;
});
