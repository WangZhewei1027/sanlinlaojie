"use server";

import { getSessionUser } from "@/lib/auth/server";
import { setUserPassword } from "@/lib/auth/users.server";

// 已登录用户直接设置新密码（/auth/update-password 不带 token 时走这里）。
// Better Auth 的 /change-password 要求提供旧密码，而现有表单不收集旧密码，
// 所以沿用 Supabase 时代 updateUser({ password }) 的语义：凭当前会话直接改。
// 返回值与 lib/auth/sms.ts 一致：code 为机器码，由 lib/auth/auth-error.ts 翻译。

// 与 lib/auth/server.ts 的 minPasswordLength 保持一致
const MIN_PASSWORD_LENGTH = 6;

export async function setOwnPassword(
  newPassword: string,
): Promise<{ success: boolean; code?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, code: "unauthorized", error: "Unauthorized" };
  }
  if (
    typeof newPassword !== "string" ||
    newPassword.length < MIN_PASSWORD_LENGTH
  ) {
    return {
      success: false,
      code: "password_too_short",
      error: "Password too short",
    };
  }

  try {
    await setUserPassword(user.id, newPassword);
    return { success: true };
  } catch (error) {
    console.error("[auth] set own password error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Password update failed",
    };
  }
}
