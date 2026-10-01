/**
 * 批量注册User脚本
 *
 * 直接写入自建数据库：auth.users / auth.account（Better Auth 读取的表），触发器
 * handle_new_user() 同步 public.users 并创建个人组织 / 默认工作区；可选再把用户
 * 加入指定组织和工作区。
 *
 * 用法:
 *   1. 在 .env.local 中配置:
 *        DATABASE_URL=postgres://user:pass@host:5432/dbname
 *
 *   2. 编辑下方 USERS 数组，填入要注册的User信息
 *
 *   3. 运行（必须带 --conditions react-server）:
 *        npx tsx --conditions react-server scripts/batch-register-users.ts
 *
 *      lib/db 与 lib/auth/users.server 以 `import "server-only"` 标记，该包在
 *      非 React Server 环境下一经 import 就抛错；"react-server" 这个 exports
 *      condition 让它解析到空模块（见 node_modules/server-only/package.json）。
 *
 *   可选参数:
 *     --dry-run                  仅打印即将创建的User，不实际执行
 *     --file <path>              从 JSON 文件读取User列表 (格式见下方 UserInput)
 *     --org <uuid>               将所有用户加入指定组织
 *     --org-role <role>          组织角色 (owner/admin/member/viewer，默认 member)
 *     --workspace <uuid>         将所有用户分配到指定工作区
 *     --workspace-role <role>    工作区角色 (默认 member)
 *
 *   示例:
 *     npx tsx --conditions react-server scripts/batch-register-users.ts --dry-run
 *     npx tsx --conditions react-server scripts/batch-register-users.ts --file users.json
 *     npx tsx --conditions react-server scripts/batch-register-users.ts --file users.json --org <org_uuid> --workspace <ws_uuid>
 *     npx tsx --conditions react-server scripts/batch-register-users.ts --file users.json --org <org_uuid> --org-role admin
 */

import * as fs from "fs";
import * as path from "path";
import { loadEnvFile } from "./lib/env";

// ─── 类型定义 ────────────────────────────────────────────

type OrgRole = "owner" | "admin" | "member" | "viewer";

interface UserInput {
  email: string;
  password: string;
  /** User显示名称（可选） */
  name?: string;
  /** 已弃用：自建认证没有 user_metadata，保留字段仅为兼容旧的 JSON 文件，会被忽略 */
  metadata?: Record<string, unknown>;
  /** 覆盖全局 --org（可选） */
  orgId?: string;
  /** 覆盖全局 --org-role（可选） */
  orgRole?: OrgRole;
  /** 覆盖全局 --workspace（可选） */
  workspaceId?: string;
  /** 覆盖全局 --workspace-role（可选） */
  workspaceRole?: string;
}

interface Result {
  email: string;
  success: boolean;
  userId?: string;
  orgAssigned?: boolean;
  workspaceAssigned?: boolean;
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

// ─── 主函数 ──────────────────────────────────────────────

async function main() {
  // lib/db 在模块加载时就读取 DATABASE_URL，所以先加载 .env.local，再动态 import
  loadEnvFile();

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileIndex = args.indexOf("--file");

  // 解析 org / workspace 全局参数
  const globalOrgId = getArg(args, "--org");
  const globalOrgRole = (getArg(args, "--org-role") ?? "member") as OrgRole;
  const globalWorkspaceId = getArg(args, "--workspace");
  const globalWorkspaceRole = getArg(args, "--workspace-role") ?? "member";

  const validOrgRoles: OrgRole[] = ["owner", "admin", "member", "viewer"];
  if (!validOrgRoles.includes(globalOrgRole)) {
    console.error(
      `❌ 无效的 --org-role: "${globalOrgRole}"，允许值: ${validOrgRoles.join(", ")}`,
    );
    process.exit(1);
  }

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
  if (!process.env.DATABASE_URL) {
    console.error("❌ 缺少环境变量，请在 .env.local 中配置:");
    console.error("   - DATABASE_URL");
    process.exit(1);
  }

  const { db } = await import("@/lib/db");
  const { createUserWithPassword } = await import("@/lib/auth/users.server");

  // 打印配置摘要
  console.log(`\n🚀 准备注册 ${users.length} 个User`);
  if (globalOrgId) {
    console.log(`   组织 ID  : ${globalOrgId} (角色: ${globalOrgRole})`);
  }
  if (globalWorkspaceId) {
    console.log(
      `   工作区 ID: ${globalWorkspaceId} (角色: ${globalWorkspaceRole})`,
    );
  }
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

    // 合并每用户覆盖与全局参数
    const orgId = user.orgId ?? globalOrgId;
    const orgRole = (user.orgRole ?? globalOrgRole) as OrgRole;
    const workspaceId = user.workspaceId ?? globalWorkspaceId;
    const workspaceRole = user.workspaceRole ?? globalWorkspaceRole;

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
      const tags = [
        `name: ${user.name || "-"}`,
        orgId ? `org: ${orgId} (${orgRole})` : null,
        workspaceId ? `ws: ${workspaceId} (${workspaceRole})` : null,
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`${index} 🔍 ${user.email} (${tags})`);
      results.push({ email: user.email, success: true });
      successCount++;
      continue;
    }

    try {
      // ① 创建 auth 用户（邮箱自动确认）；触发器同步 public.users（含 name）
      //    邮箱已注册时抛 UserExistsError，走下方统一的失败处理
      const { id: userId } = await createUserWithPassword({
        email: user.email,
        password: user.password,
        name: user.name,
        emailVerified: true,
      });

      // ② 加入组织（已是成员则更新角色）
      let orgAssigned = false;
      if (orgId) {
        try {
          await db
            .insertInto("organization_member")
            .values({ organization_id: orgId, user_id: userId, role: orgRole })
            .onConflict((oc) =>
              oc.columns(["organization_id", "user_id"]).doUpdateSet({ role: orgRole }),
            )
            .execute();
          orgAssigned = true;
        } catch (orgError) {
          console.warn(
            `${index} ⚠️  ${user.email} — 加入组织失败: ${errorMessage(orgError)}`,
          );
        }
      }

      // ③ 分配工作区（已分配则更新角色）
      let workspaceAssigned = false;
      if (workspaceId) {
        try {
          await db
            .insertInto("workspace_assignment")
            .values({ workspace_id: workspaceId, user_id: userId, role: workspaceRole })
            .onConflict((oc) =>
              oc.columns(["user_id", "workspace_id"]).doUpdateSet({ role: workspaceRole }),
            )
            .execute();
          workspaceAssigned = true;
        } catch (wsError) {
          console.warn(
            `${index} ⚠️  ${user.email} — 分配工作区失败: ${errorMessage(wsError)}`,
          );
        }
      }

      const tags = [
        orgAssigned ? `org ✅` : null,
        workspaceAssigned ? `ws ✅` : null,
      ]
        .filter(Boolean)
        .join(" ");
      console.log(
        `${index} ✅ ${user.email} (id: ${userId})${tags ? " — " + tags : ""}`,
      );
      results.push({
        email: user.email,
        success: true,
        userId,
        orgAssigned,
        workspaceAssigned,
      });
      successCount++;
    } catch (err) {
      const message = errorMessage(err);
      console.log(`${index} ❌ ${user.email} — ${message}`);
      results.push({ email: user.email, success: false, error: message });
      failCount++;
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

  // 关闭连接池，否则进程不会退出
  await db.destroy();
}

/** 从 argv 中读取命名参数值，例如 getArg(args, '--org') */
function getArg(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) {
    return args[idx + 1];
  }
  return undefined;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

main().catch((err) => {
  console.error("脚本执行出错:", err);
  process.exit(1);
});
