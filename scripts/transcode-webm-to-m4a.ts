/**
 * 批量转码脚本：WebM → M4A
 *
 * 扫描 Supabase Storage `assets` bucket 中所有 .webm 文件，
 * 通过 Cloudinary 远程转码为 .m4a（AAC），回传到 Supabase 原路径，
 * 并更新 asset 表中的 file_url。
 *
 * 环境变量（.env.local）:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
 *   CLOUDINARY_CLOUD_NAME=your_cloud_name
 *   CLOUDINARY_API_KEY=your_api_key
 *   CLOUDINARY_API_SECRET=your_api_secret
 *
 * 用法:
 *   npx tsx scripts/transcode-webm-to-m4a.ts
 *   npx tsx scripts/transcode-webm-to-m4a.ts --dry-run
 *   npx tsx scripts/transcode-webm-to-m4a.ts --limit 5
 *   npx tsx scripts/transcode-webm-to-m4a.ts --keep-webm
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";
import * as fs from "fs";
import * as path from "path";

// ─── 类型定义 ────────────────────────────────────────────

interface TranscodeResult {
  path: string;
  success: boolean;
  newPath?: string;
  dbUpdated?: boolean;
  error?: string;
}

// ─── 环境变量加载 ──────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

// ─── 递归列出 bucket 中所有文件 ──────────────────────────────

async function listAllFiles(
  supabase: SupabaseClient,
  bucket: string,
  folder: string = "",
): Promise<string[]> {
  const allPaths: string[] = [];

  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    console.error(`❌ 列出文件夹 "${folder}" 失败: ${error.message}`);
    return allPaths;
  }

  if (!data) return allPaths;

  for (const item of data) {
    const itemPath = folder ? `${folder}/${item.name}` : item.name;

    // Supabase storage: items without metadata.mimetype are folders
    if (!item.metadata?.mimetype) {
      // 递归进入子文件夹
      const subFiles = await listAllFiles(supabase, bucket, itemPath);
      allPaths.push(...subFiles);
    } else {
      allPaths.push(itemPath);
    }
  }

  return allPaths;
}

// ─── 延迟函数 ──────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── 主函数 ──────────────────────────────────────────────

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const keepWebm = args.includes("--keep-webm");
  const limitIndex = args.indexOf("--limit");
  const limit =
    limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : Infinity;

  // ── 验证环境变量 ──

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudApiKey = process.env.CLOUDINARY_API_KEY;
  const cloudApiSecret = process.env.CLOUDINARY_API_SECRET;

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!cloudName) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!cloudApiKey) missing.push("CLOUDINARY_API_KEY");
  if (!cloudApiSecret) missing.push("CLOUDINARY_API_SECRET");

  if (missing.length > 0) {
    console.error("❌ 缺少环境变量，请在 .env.local 中配置:");
    missing.forEach((k) => console.error(`   - ${k}`));
    process.exit(1);
  }

  // ── 初始化客户端 ──

  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  cloudinary.config({
    cloud_name: cloudName,
    api_key: cloudApiKey,
    api_secret: cloudApiSecret,
  });

  // ── 扫描 bucket ──

  console.log("\n🔍 正在扫描 assets bucket ...");
  const allFiles = await listAllFiles(supabase, "assets");
  const webmFiles = allFiles
    .filter((f) => f.toLowerCase().endsWith(".webm"))
    .slice(0, limit);

  console.log(
    `📊 共找到 ${allFiles.length} 个文件，其中 ${webmFiles.length} 个 .webm 文件`,
  );

  if (webmFiles.length === 0) {
    console.log("✅ 没有需要转码的 .webm 文件");
    return;
  }

  if (dryRun) {
    console.log("\n⚠️  DRY RUN 模式 — 不会执行转码\n");
    console.log("─".repeat(60));
    webmFiles.forEach((f, i) => console.log(`  [${i + 1}] ${f}`));
    console.log("─".repeat(60));
    console.log(`\n共 ${webmFiles.length} 个文件待转码`);
    return;
  }

  // ── 逐个转码 ──

  console.log("\n🚀 开始转码...\n");
  console.log("─".repeat(60));

  const results: TranscodeResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < webmFiles.length; i++) {
    const webmPath = webmFiles[i];
    const m4aPath = webmPath.replace(/\.webm$/i, ".m4a");
    const index = `[${i + 1}/${webmFiles.length}]`;

    try {
      // 1. 获取 Supabase 公开 URL
      const {
        data: { publicUrl: webmPublicUrl },
      } = supabase.storage.from("assets").getPublicUrl(webmPath);

      console.log(`${index} 📤 上传到 Cloudinary: ${webmPath}`);

      // 2. 上传到 Cloudinary 并转码为 m4a
      const uploadResult = await cloudinary.uploader.upload(webmPublicUrl, {
        resource_type: "video",
        format: "m4a",
        folder: "transcode-temp",
      });

      const cloudinaryUrl = uploadResult.secure_url;
      const cloudinaryPublicId = uploadResult.public_id;

      console.log(`${index} 🔄 转码完成，下载 m4a ...`);

      // 3. 下载转码后的 m4a
      const response = await fetch(cloudinaryUrl);
      if (!response.ok) {
        throw new Error(`下载 m4a 失败: HTTP ${response.status}`);
      }
      const m4aBuffer = Buffer.from(await response.arrayBuffer());

      console.log(
        `${index} 📥 下载完成 (${(m4aBuffer.length / 1024).toFixed(1)}KB)，上传到 Supabase ...`,
      );

      // 4. 上传 m4a 到 Supabase（同路径，新扩展名）
      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(m4aPath, m4aBuffer, {
          contentType: "audio/mp4",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`上传 m4a 到 Supabase 失败: ${uploadError.message}`);
      }

      // 5. 获取新的公开 URL
      const {
        data: { publicUrl: m4aPublicUrl },
      } = supabase.storage.from("assets").getPublicUrl(m4aPath);

      // 6. 更新 asset 表中的 file_url
      const oldPublicUrl = webmPublicUrl;
      const { error: dbError, count } = await supabase
        .from("asset")
        .update({ file_url: m4aPublicUrl })
        .eq("file_url", oldPublicUrl);

      const dbUpdated = !dbError;
      if (dbError) {
        console.warn(
          `${index} ⚠️  数据库更新失败（文件已转码）: ${dbError.message}`,
        );
      } else {
        console.log(
          `${index} 🗃️  数据库已更新${count !== null ? ` (${count} 条记录)` : ""}`,
        );
      }

      // 7. 删除旧的 .webm 文件
      if (!keepWebm) {
        const { error: removeError } = await supabase.storage
          .from("assets")
          .remove([webmPath]);

        if (removeError) {
          console.warn(
            `${index} ⚠️  删除旧 .webm 失败: ${removeError.message}`,
          );
        }
      }

      // 8. 清理 Cloudinary 临时文件
      try {
        await cloudinary.uploader.destroy(cloudinaryPublicId, {
          resource_type: "video",
        });
      } catch {
        // 清理失败不影响主流程
      }

      console.log(`${index} ✅ ${webmPath} → ${m4aPath}`);
      results.push({
        path: webmPath,
        success: true,
        newPath: m4aPath,
        dbUpdated,
      });
      successCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误";
      console.log(`${index} ❌ ${webmPath} — ${message}`);
      results.push({ path: webmPath, success: false, error: message });
      failCount++;
    }

    // 限流：每个文件间隔 500ms
    if (i < webmFiles.length - 1) {
      await sleep(500);
    }
  }

  // ── 汇总 ──

  console.log("\n" + "─".repeat(60));
  console.log(`\n📊 转码完成:`);
  console.log(`   ✅ 成功: ${successCount}`);
  console.log(`   ❌ 失败: ${failCount}`);
  if (keepWebm) {
    console.log(`   📁 保留原 .webm 文件 (--keep-webm)`);
  }

  // 保存结果到 JSON
  const resultPath = path.resolve(
    process.cwd(),
    "scripts/transcode-results.json",
  );
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 详细结果已保存到: ${resultPath}\n`);
}

// ─── 执行 ────────────────────────────────────────────────

main().catch((err) => {
  console.error("❌ 脚本执行出错:", err);
  process.exit(1);
});
