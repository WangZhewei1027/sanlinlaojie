/**
 * 批量注册User脚本
 *
 * 使用 Supabase Admin API (service_role key) 批量创建User。
 *
 * 用法:
 *   1. 在 .env.local 中配置:
 *        NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
 *
 *   2. 编辑下方 USERS 数组，填入要注册的User信息
 *
 *   3. 运行:
 *        npx tsx scripts/batch-register-users.ts
 *
 *   可选参数:
 *     --dry-run    仅打印即将创建的User，不实际执行
 *     --file       从 JSON 文件读取User列表 (格式见下方 UserInput)
 *
 *   示例:
 *     npx tsx scripts/batch-register-users.ts --dry-run
 *     npx tsx scripts/batch-register-users.ts --file users.json
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ─── 类型定义 ────────────────────────────────────────────

interface UserInput {
  email: string;
  password: string;
  /** User显示名称（可选） */
  name?: string;
  /** 额外的 user_metadata（可选） */
  metadata?: Record<string, unknown>;
}

interface Result {
  email: string;
  success: boolean;
  userId?: string;
  error?: string;
}

// ─── 配置：在这里填入要批量注册的User ──────────────────────

const USERS: UserInput[] = [
  // 示例（取消注释并修改）：
  { email: "aa8618@nyu.edu", password: "12345678", name: "User4" },
  { email: "lm4652@nyu.edu", password: "12345678", name: "User5" },
  { email: "xz4041@nyu.edu", password: "12345678", name: "User6" },
  { email: "sd4835@nyu.edu", password: "12345678", name: "User7" },
  { email: "qc1097@nyu.edu", password: "12345678", name: "User8" },
  { email: "zz10330@nyu.edu", password: "12345678", name: "User9" },
  { email: "rch9284@nyu.edu", password: "12345678", name: "User10" },
  { email: "yh5675@nyu.edu", password: "12345678", name: "User11" },
  { email: "sc10486@nyu.edu", password: "12345678", name: "User12" },
  { email: "sy4301@nyu.edu", password: "12345678", name: "User13" },
  { email: "cy2520@nyu.edu", password: "12345678", name: "User14" },
  { email: "tfr9406@nyu.edu", password: "12345678", name: "User15" },
  { email: "xc3083@nyu.edu", password: "12345678", name: "User16" },
  { email: "cy2767@nyu.edu", password: "12345678", name: "User17" },
  { email: "jz7112@nyu.edu", password: "12345678", name: "User18" },
  { email: "vt2162@nyu.edu", password: "12345678", name: "User19" },
  { email: "mrc697@nyu.edu", password: "12345678", name: "User20" },
  { email: "tl4435@nyu.edu", password: "12345678", name: "User21" },
  { email: "gan9743@nyu.edu", password: "12345678", name: "User22" },
  { email: "xw3378@nyu.edu", password: "12345678", name: "User23" },
  { email: "nh2530@nyu.edu", password: "12345678", name: "User24" },
  { email: "ll5387@nyu.edu", password: "12345678", name: "User25" },
  { email: "yh5850@nyu.edu", password: "12345678", name: "User26" },
  { email: "il2268@nyu.edu", password: "12345678", name: "User27" },
  { email: "dwm9023@nyu.edu", password: "12345678", name: "User28" },
  { email: "ll4866@nyu.edu", password: "12345678", name: "User29" },
  { email: "eu2094@nyu.edu", password: "12345678", name: "User30" },
];

// ─── 环境变量加载 ──────────────────────────────────────────

function loadEnv() {
  // 尝试从 .env.local 加载环境变量（简易实现，无需 dotenv 依赖）
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

// ─── 主函数 ──────────────────────────────────────────────

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileIndex = args.indexOf("--file");

  // 确定User列表来源
  let users: UserInput[];

  if (fileIndex !== -1 && args[fileIndex + 1]) {
    const filePath = path.resolve(process.cwd(), args[fileIndex + 1]);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`);
      process.exit(1);
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    users = JSON.parse(raw) as UserInput[];
    console.log(`📄 从文件加载了 ${users.length} 个User`);
  } else {
    users = USERS;
  }

  if (users.length === 0) {
    console.error(
      "❌ User列表为空。请编辑脚本中的 USERS 数组或使用 --file 参数指定 JSON 文件。",
    );
    process.exit(1);
  }

  // 验证环境变量
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ 缺少环境变量，请在 .env.local 中配置:");
    if (!supabaseUrl) console.error("   - NEXT_PUBLIC_SUPABASE_URL");
    if (!serviceRoleKey) console.error("   - SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // 创建 Admin 客户端（使用 service_role key 绕过 RLS）
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`\n🚀 准备注册 ${users.length} 个User`);
  if (dryRun) {
    console.log("⚠️  DRY RUN 模式 — 不会实际创建User\n");
  }
  console.log("─".repeat(60));

  // 逐个注册
  const results: Result[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const index = `[${i + 1}/${users.length}]`;

    // 基本验证
    if (!user.email || !user.password) {
      console.log(`${index} ⏭️  跳过: 缺少 email 或 password`);
      results.push({
        email: user.email || "(empty)",
        success: false,
        error: "缺少 email 或 password",
      });
      failCount++;
      continue;
    }

    if (user.password.length < 6) {
      console.log(`${index} ⏭️  跳过 ${user.email}: 密码长度不足 6 位`);
      results.push({
        email: user.email,
        success: false,
        error: "密码长度不足 6 位",
      });
      failCount++;
      continue;
    }

    if (dryRun) {
      console.log(`${index} 🔍 ${user.email} (name: ${user.name || "-"})`);
      results.push({ email: user.email, success: true });
      successCount++;
      continue;
    }

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // 自动确认邮箱，跳过验证流程
        user_metadata: {
          ...(user.name ? { name: user.name } : {}),
          ...user.metadata,
        },
      });

      if (error) {
        console.log(`${index} ❌ ${user.email} — ${error.message}`);
        results.push({
          email: user.email,
          success: false,
          error: error.message,
        });
        failCount++;
      } else {
        console.log(`${index} ✅ ${user.email} (id: ${data.user.id})`);
        results.push({
          email: user.email,
          success: true,
          userId: data.user.id,
        });
        successCount++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`${index} ❌ ${user.email} — ${message}`);
      results.push({ email: user.email, success: false, error: message });
      failCount++;
    }

    // 简单限速，避免触发 rate limit
    if (i < users.length - 1) {
      await sleep(200);
    }
  }

  // 汇总
  console.log("─".repeat(60));
  console.log(
    `\n📊 完成: ${successCount} 成功, ${failCount} 失败, 共 ${users.length} 个`,
  );

  // 如果有失败，输出失败详情
  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    console.log("\n❌ 失败详情:");
    for (const f of failed) {
      console.log(`   ${f.email}: ${f.error}`);
    }
  }

  // 输出结果到 JSON 文件
  const outputPath = path.resolve(
    process.cwd(),
    "scripts/batch-register-results.json",
  );
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n📁 结果已保存到 ${outputPath}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("脚本执行出错:", err);
  process.exit(1);
});
