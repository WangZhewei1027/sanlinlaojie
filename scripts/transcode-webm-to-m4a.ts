/**
 * 批量转码脚本：WebM → M4A
 *
 * 查询 asset 表中 file_url 以 .webm 结尾的音频资产，下载原文件，用本机 ffmpeg
 * 转码为 .m4a（AAC），上传到 OSS 的同一 key（仅扩展名换成 .m4a——小程序依赖
 * 这个"同名 .m4a"约定，见 docs/audio-compatibility.md），并更新 asset 表中的
 * file_url。.m4a 已存在的 key 跳过下载/转码/上传，只补做数据库更新，脚本可安全重跑。
 *
 * 环境变量（.env.local）:
 *   DATABASE_URL=postgres://...
 *   OSS_BUCKET / OSS_REGION
 *   ALIBABA_CLOUD_ACCESS_KEY_ID / ALIBABA_CLOUD_ACCESS_KEY_SECRET
 *   NEXT_PUBLIC_MEDIA_BASE_URL=https://media.example.com
 *
 * 依赖：本机 PATH 中的 ffmpeg（brew install ffmpeg / apt install ffmpeg）。
 *
 * 用法——lib/db 与 lib/storage/oss 带 "server-only" 守卫（node_modules/server-only
 * 的 exports 在 react-server 条件下指向空模块），所以必须带 --conditions 运行:
 *   npx tsx --conditions react-server scripts/transcode-webm-to-m4a.ts
 *   npx tsx --conditions react-server scripts/transcode-webm-to-m4a.ts --dry-run
 *   npx tsx --conditions react-server scripts/transcode-webm-to-m4a.ts --limit 5
 *   npx tsx --conditions react-server scripts/transcode-webm-to-m4a.ts --delete-webm
 *
 * 默认保留原始 .webm 文件（安全起见）；仅在确认 m4a 可用后，
 * 显式传入 --delete-webm 才会从 OSS 删除原文件。
 */

import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { loadEnvFile } from "./lib/env";

const execFileAsync = promisify(execFile);

// ─── 类型定义 ────────────────────────────────────────────

interface TranscodeResult {
  path: string;
  success: boolean;
  newPath?: string;
  dbUpdated?: boolean;
  /** .m4a 已存在：跳过了下载/转码/上传，只做了数据库更新 */
  skippedTranscode?: boolean;
  error?: string;
}

const REQUIRED_ENV = [
  "DATABASE_URL",
  "OSS_BUCKET",
  "OSS_REGION",
  "ALIBABA_CLOUD_ACCESS_KEY_ID",
  "ALIBABA_CLOUD_ACCESS_KEY_SECRET",
  "NEXT_PUBLIC_MEDIA_BASE_URL",
];

// ─── ffmpeg 转码 ──────────────────────────────────────────

/** 确认本机 ffmpeg 可用，缺失时给出明确提示而不是在第一个文件上才失败。 */
async function assertFfmpeg(): Promise<void> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
  } catch {
    throw new Error(
      "未找到 ffmpeg，请先安装（brew install ffmpeg）并确保其在 PATH 中",
    );
  }
}

/** WebM/Opus → M4A/AAC 128k，经临时目录走本机 ffmpeg。 */
async function transcodeToM4a(webm: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "transcode-webm-"));
  const input = join(dir, "in.webm");
  const output = join(dir, "out.m4a");
  try {
    await writeFile(input, webm);
    await execFileAsync("ffmpeg", [
      "-loglevel", "error",
      "-i", input,
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      output,
    ]);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ─── 主函数 ──────────────────────────────────────────────

async function main() {
  loadEnvFile();

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  // 默认保留原始 .webm（防止转码结果损坏时丢失唯一原件），删除需显式传 --delete-webm
  const deleteWebm = args.includes("--delete-webm");
  const limitIndex = args.indexOf("--limit");
  const limit =
    limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : Infinity;

  // ── 验证环境变量 ──

  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error("❌ 缺少环境变量，请在 .env.local 中配置:");
    missing.forEach((k) => console.error(`   - ${k}`));
    process.exit(1);
  }

  await assertFfmpeg();

  // ── 初始化客户端 ──
  // lib/db 建连接池、lib/storage/public-url 读媒体域名都发生在模块加载时，
  // 必须等 .env.local 加载完再 import。
  const { db } = await import("../lib/db");
  const { assetKeyFromUrl, deleteObjects, headObject, mediaUrl, putObject } =
    await import("../lib/storage/oss");

  try {
    // ── 查询待转码资产 ──

    console.log("\n🔍 正在查询 asset 表中的 .webm 音频 ...");
    const rows = await db
      .selectFrom("asset")
      .select("file_url")
      .distinct()
      .where("file_type", "=", "audio")
      .where("file_url", "ilike", "%.webm")
      .orderBy("file_url", "asc")
      .execute();

    // 同一 URL 可能被多行共享（内容去重），按 URL 去重；只处理本站 OSS 上的对象
    const webmUrls = rows
      .map((r) => r.file_url)
      .filter((u): u is string => !!u);
    const targets = webmUrls
      .flatMap((url) => {
        const key = assetKeyFromUrl(url);
        return key ? [{ url, key }] : [];
      })
      .slice(0, limit);

    console.log(
      `📊 共找到 ${webmUrls.length} 个 .webm 音频 URL，其中 ${targets.length} 个位于 OSS 待转码`,
    );

    if (targets.length === 0) {
      console.log("✅ 没有需要转码的 .webm 文件");
      return;
    }

    if (dryRun) {
      console.log("\n⚠️  DRY RUN 模式 — 不会执行转码\n");
      console.log("─".repeat(60));
      targets.forEach((t, i) => console.log(`  [${i + 1}] ${t.key}`));
      console.log("─".repeat(60));
      console.log(`\n共 ${targets.length} 个文件待转码`);
      return;
    }

    // ── 逐个转码 ──

    console.log("\n🚀 开始转码...\n");
    console.log("─".repeat(60));

    const results: TranscodeResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const { url: webmUrl, key: webmKey } = targets[i];
      const m4aKey = webmKey.replace(/\.webm$/i, ".m4a");
      const index = `[${i + 1}/${targets.length}]`;

      try {
        let m4aUrl: string;
        let skippedTranscode = false;

        // 1. 已有同名 .m4a（上次可能中断在数据库更新之前）→ 跳过转码，只补数据库
        if (await headObject(m4aKey)) {
          console.log(`${index} ⏭️  m4a 已存在，跳过转码: ${m4aKey}`);
          m4aUrl = mediaUrl(m4aKey);
          skippedTranscode = true;
        } else {
          // 2. 下载原始 .webm
          console.log(`${index} 📥 下载: ${webmKey}`);
          const response = await fetch(webmUrl);
          if (!response.ok) {
            throw new Error(`下载 webm 失败: HTTP ${response.status}`);
          }
          const webmBuffer = Buffer.from(await response.arrayBuffer());

          // 3. 本机 ffmpeg 转码
          console.log(
            `${index} 🔄 ffmpeg 转码 (${(webmBuffer.length / 1024).toFixed(1)}KB) ...`,
          );
          const m4aBuffer = await transcodeToM4a(webmBuffer);

          // 4. 上传 m4a 到 OSS（同 key，新扩展名）
          console.log(
            `${index} 📤 上传到 OSS (${(m4aBuffer.length / 1024).toFixed(1)}KB): ${m4aKey}`,
          );
          m4aUrl = await putObject(m4aKey, m4aBuffer, {
            contentType: "audio/mp4",
          });
        }

        // 5. 更新 asset 表中的 file_url（同一 URL 可能被多行共享，一次全改）
        let dbUpdated = false;
        try {
          const updated = await db
            .updateTable("asset")
            .set({ file_url: m4aUrl })
            .where("file_url", "=", webmUrl)
            .executeTakeFirst();
          console.log(
            `${index} 🗃️  数据库已更新 (${Number(updated.numUpdatedRows)} 条记录)`,
          );
          dbUpdated = true;
        } catch (dbErr) {
          console.warn(
            `${index} ⚠️  数据库更新失败（文件已转码）: ${
              dbErr instanceof Error ? dbErr.message : "未知错误"
            }`,
          );
        }

        // 6. 删除旧的 .webm：仅在显式传入 --delete-webm 且行已指向 m4a 时
        //    （数据库没更新成功就删原件会留下死链）
        if (deleteWebm && dbUpdated) {
          try {
            await deleteObjects([webmKey]);
          } catch (removeErr) {
            console.warn(
              `${index} ⚠️  删除旧 .webm 失败: ${
                removeErr instanceof Error ? removeErr.message : "未知错误"
              }`,
            );
          }
        }

        console.log(`${index} ✅ ${webmKey} → ${m4aKey}`);
        results.push({
          path: webmKey,
          success: true,
          newPath: m4aKey,
          dbUpdated,
          ...(skippedTranscode ? { skippedTranscode } : {}),
        });
        successCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "未知错误";
        console.log(`${index} ❌ ${webmKey} — ${message}`);
        results.push({ path: webmKey, success: false, error: message });
        failCount++;
      }
    }

    // ── 汇总 ──

    console.log("\n" + "─".repeat(60));
    console.log(`\n📊 转码完成:`);
    console.log(`   ✅ 成功: ${successCount}`);
    console.log(`   ❌ 失败: ${failCount}`);
    if (deleteWebm) {
      console.log(`   🗑️  已删除原 .webm 文件 (--delete-webm)`);
    } else {
      console.log(`   📁 保留原 .webm 文件（默认；传 --delete-webm 可删除）`);
    }

    // 保存结果到 JSON
    const resultPath = resolve(process.cwd(), "scripts/transcode-results.json");
    writeFileSync(resultPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 详细结果已保存到: ${resultPath}\n`);
  } finally {
    // 关闭连接池，否则进程不会退出
    await db.destroy();
  }
}

// ─── 执行 ────────────────────────────────────────────────

main().catch((err) => {
  console.error("❌ 脚本执行出错:", err);
  process.exit(1);
});
