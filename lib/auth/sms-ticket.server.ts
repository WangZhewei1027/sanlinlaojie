import { createHmac, timingSafeEqual } from "node:crypto";

// 短信验证通过凭证：CheckSmsVerifyCode 校验成功后签发，
// createUserByPhone / resetPasswordByPhone 必须凭它才能操作账号，
// 防止绕过前端直接调用 server action 给任意手机号注册或改密码。
// 凭证绑定账号（手机号对应的虚拟邮箱）与过期时间，HMAC 签名，服务端无状态。
//
// 注意：本文件不能加 "use server"——那样导出的函数会变成可被客户端直接调用的 action。

const TICKET_TTL_MS = 10 * 60 * 1000;

function ticketKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  // 从 service role key 派生专用子密钥，避免直接用它做签名
  return createHmac("sha256", secret)
    .update("sms-verification-ticket/v1")
    .digest();
}

function sign(payload: string): Buffer {
  return createHmac("sha256", ticketKey()).update(payload).digest();
}

/** 为已通过短信验证的账号签发凭证 */
export function issueSmsTicket(account: string, now = Date.now()): string {
  const payload = `${account}|${now + TICKET_TTL_MS}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload).toString("base64url")}`;
}

/** 校验凭证：签名正确、账号一致且未过期才返回 true */
export function verifySmsTicket(
  ticket: unknown,
  account: string,
  now = Date.now(),
): boolean {
  if (typeof ticket !== "string") return false;
  const [encoded, signature, ...rest] = ticket.split(".");
  if (!encoded || !signature || rest.length > 0) return false;

  const payload = Buffer.from(encoded, "base64url").toString();
  const expected = sign(payload);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return false;
  }

  const separator = payload.lastIndexOf("|");
  const expiresAt = Number(payload.slice(separator + 1));
  return (
    payload.slice(0, separator) === account &&
    Number.isFinite(expiresAt) &&
    now < expiresAt
  );
}
