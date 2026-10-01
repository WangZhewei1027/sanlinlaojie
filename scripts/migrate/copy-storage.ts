import { mkdirSync, writeFileSync } from "node:fs";
import OSS from "ali-oss";
import { loadEnvFile, requireEnv } from "../lib/env";

/**
 * One-shot migration: copy every object in the Supabase Storage buckets to the
 * OSS bucket, keeping the object path (bucket name becomes the key prefix):
 *
 *   assets/{userId}/{file}            ← bucket "assets"
 *   wechat-qrcodes/release/{file}     ← bucket "wechat-qrcodes"
 *
 *   npx tsx scripts/migrate/copy-storage.ts [--dry-run] [--bucket=assets]
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (listing) and
 * ALIBABA_CLOUD_ACCESS_KEY_* + OSS_BUCKET + OSS_REGION (upload) in .env.local.
 * Idempotent: objects already in OSS with the same size are skipped, so it can
 * be re-run for the incremental pass during the maintenance window. Writes a
 * manifest to .migration/storage-manifest.json for verification.
 */

const BUCKETS: Record<string, { prefix: string; cacheControl: string }> = {
  assets: { prefix: "assets/", cacheControl: "public, max-age=31536000, immutable" },
  "wechat-qrcodes": { prefix: "wechat-qrcodes/", cacheControl: "public, max-age=31536000" },
};
const CONCURRENCY = 8;

interface SupabaseObject {
  name: string;
  id: string | null;
  metadata: { size?: number; mimetype?: string } | null;
}

interface ManifestEntry {
  bucket: string;
  name: string;
  key: string;
  size: number;
  mimetype: string;
  status: "uploaded" | "skipped" | "dry-run" | "failed";
  error?: string;
}

async function listRecursive(
  supabaseUrl: string,
  serviceKey: string,
  bucket: string,
  prefix = "",
): Promise<SupabaseObject[]> {
  const out: SupabaseObject[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prefix,
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix}: ${res.status} ${await res.text()}`);
    const items = (await res.json()) as SupabaseObject[];
    for (const item of items) {
      const fullName = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        // folder
        out.push(...(await listRecursive(supabaseUrl, serviceKey, bucket, fullName)));
      } else {
        out.push({ ...item, name: fullName });
      }
    }
    if (items.length < 1000) break;
  }
  return out;
}

async function main() {
  loadEnvFile();
  const dryRun = process.argv.includes("--dry-run");
  const only = process.argv.find((a) => a.startsWith("--bucket="))?.slice("--bucket=".length);

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const oss = new OSS({
    region: requireEnv("OSS_REGION"),
    bucket: requireEnv("OSS_BUCKET"),
    accessKeyId: requireEnv("ALIBABA_CLOUD_ACCESS_KEY_ID"),
    accessKeySecret: requireEnv("ALIBABA_CLOUD_ACCESS_KEY_SECRET"),
    secure: true,
    timeout: 120_000,
  });

  const manifest: ManifestEntry[] = [];
  for (const [bucket, { prefix, cacheControl }] of Object.entries(BUCKETS)) {
    if (only && only !== bucket) continue;
    const objects = await listRecursive(supabaseUrl, serviceKey, bucket);
    const totalBytes = objects.reduce((s, o) => s + (o.metadata?.size ?? 0), 0);
    console.log(`${bucket}: ${objects.length} objects, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

    let done = 0;
    const queue = [...objects];
    const worker = async () => {
      for (;;) {
        const obj = queue.shift();
        if (!obj) return;
        const key = `${prefix}${obj.name}`;
        const size = obj.metadata?.size ?? 0;
        const mimetype = obj.metadata?.mimetype ?? "application/octet-stream";
        const entry: ManifestEntry = { bucket, name: obj.name, key, size, mimetype, status: "failed" };
        manifest.push(entry);
        try {
          if (dryRun) {
            entry.status = "dry-run";
          } else {
            let existingSize = -1;
            try {
              const head = await oss.head(key);
              existingSize = Number((head.res.headers as Record<string, string>)["content-length"]);
            } catch (err) {
              if ((err as { status?: number }).status !== 404) throw err;
            }
            if (existingSize === size) {
              entry.status = "skipped";
            } else {
              const url = `${supabaseUrl}/storage/v1/object/public/${bucket}/${obj.name
                .split("/")
                .map(encodeURIComponent)
                .join("/")}`;
              const res = await fetch(url, {
                headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
              });
              if (!res.ok) throw new Error(`download ${res.status}`);
              const buffer = Buffer.from(await res.arrayBuffer());
              if (size && buffer.length !== size)
                throw new Error(`size mismatch: expected ${size}, got ${buffer.length}`);
              await oss.put(key, buffer, {
                headers: { "Content-Type": mimetype, "Cache-Control": cacheControl },
              });
              entry.status = "uploaded";
            }
          }
        } catch (err) {
          entry.error = err instanceof Error ? err.message : String(err);
          console.error(`  ✗ ${key}: ${entry.error}`);
        }
        done += 1;
        if (done % 100 === 0 || done === objects.length) {
          console.log(`  ${bucket}: ${done}/${objects.length}`);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  mkdirSync(".migration", { recursive: true });
  writeFileSync(".migration/storage-manifest.json", JSON.stringify(manifest, null, 2));

  const summary = manifest.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log("summary:", summary);
  if (summary.failed) {
    console.error(`${summary.failed} objects failed — re-run to retry`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
