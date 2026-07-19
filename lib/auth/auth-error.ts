import type { TFunction } from "i18next";

// 统一把登录/注册/重置密码流程中的各种错误翻译成用户可读的 i18n 文案。
// 覆盖三类来源：
// 1. supabase-js 抛出的 AuthError（带 code / status / message）
// 2. 浏览器网络层错误（fetch 失败、server action 调用失败）
// 3. 服务端 server action 返回的机器码（lib/auth/sms.ts 的 code 字段）
//
// UI 上永远只显示映射后的文案，绝不透出原始英文报错；
// 未识别的错误原文通过 /api/errors 静默上报到 error_log 供排查。

// 网络层失败的常见报错：Chrome "Failed to fetch"、Node/undici "fetch failed"、
// Safari "Load failed"、Firefox "NetworkError..."、server action 请求失败
// "An unexpected response was received from the server"、超时/中断等。
const NETWORK_MESSAGE_RE =
  /failed to fetch|fetch failed|fail to fetch|network|load failed|unexpected response|timed? ?out|aborted|ERR_(NETWORK|CONNECTION|INTERNET)/i;

function messageToKey(msg: string): string | null {
  if (NETWORK_MESSAGE_RE.test(msg)) return "auth.errors.network";
  if (/invalid login credentials/i.test(msg)) {
    return "auth.errors.invalidCredentials";
  }
  if (/already (been )?registered|already exists/i.test(msg)) {
    return "auth.errors.userExists";
  }
  if (/email not confirmed/i.test(msg)) return "auth.errors.emailNotConfirmed";
  if (/rate limit|too many/i.test(msg)) return "auth.errors.rateLimited";
  if (/password.*(weak|short|at least)/i.test(msg)) {
    return "auth.errors.weakPassword";
  }
  return null;
}

/** 根据错误对象推断 i18n key（auth.errors.* 或已有的 auth.* key） */
export function authErrorKey(error: unknown): string {
  if (typeof error === "string") {
    return messageToKey(error) ?? "auth.errors.unknown";
  }
  if (!error || typeof error !== "object") {
    return "auth.errors.unknown";
  }

  const { name, status, code, message } = error as {
    name?: string;
    status?: number;
    code?: string;
    message?: string;
  };

  // 网络层失败：supabase-js 的可重试 fetch 错误，或 server action 请求本身失败
  if (
    name === "AuthRetryableFetchError" ||
    status === 0 ||
    error instanceof TypeError
  ) {
    return "auth.errors.network";
  }

  switch (code) {
    case "invalid_credentials":
      return "auth.errors.invalidCredentials";
    case "user_already_exists":
    case "email_exists":
    case "phone_exists":
      return "auth.errors.userExists";
    case "email_not_confirmed":
      return "auth.errors.emailNotConfirmed";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "auth.errors.rateLimited";
    case "weak_password":
      return "auth.errors.weakPassword";
    case "same_password":
      return "auth.errors.samePassword";
    case "email_address_invalid":
    case "validation_failed":
      return "auth.errors.invalidEmail";
    case "otp_expired":
      return "auth.otpExpired";
    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found":
      return "auth.errors.sessionExpired";
  }

  // 部分旧版本 / 边缘路径没有 code，按 message 兜底匹配
  return messageToKey(message ?? "") ?? "auth.errors.unknown";
}

/** 未识别的错误静默上报到 error_log（复用公开的 /api/errors 通道），不打扰用户 */
function reportUnknownAuthError(raw: string): void {
  if (typeof window === "undefined" || !raw) return;
  try {
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "auth.unknown",
        path: window.location.pathname,
        status: 0,
        message: raw.slice(0, 2000),
        context: { ua: navigator.userAgent },
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 上报失败直接忽略
  }
}

function rawMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "";
}

/**
 * 把错误翻译成给用户看的文案。UI 只显示干净的 i18n 文案；
 * 未识别的错误显示通用提示，原文上报到 error_log。
 */
export function formatAuthError(t: TFunction, error: unknown): string {
  const key = authErrorKey(error);
  if (key === "auth.errors.unknown") {
    console.error("[auth] unrecognized error:", error);
    reportUnknownAuthError(rawMessage(error));
  }
  return t(key);
}

/** 服务端 server action 返回的机器码 → i18n key（见 lib/auth/sms.ts） */
const SERVER_CODE_KEYS: Record<string, string> = {
  sms_rate_limited: "auth.errors.smsRateLimited",
  invalid_phone: "auth.errors.invalidPhone",
  sms_send_failed: "auth.errors.smsSendFailed",
  code_invalid: "auth.invalidOtpCode",
  code_expired: "auth.otpExpired",
  user_exists: "auth.errors.userExists",
  user_not_found: "auth.errors.phoneNotRegistered",
};

/**
 * 翻译 server action 的失败结果。优先用机器码；没有匹配时尝试按
 * 原始 message 识别，仍未识别则显示通用提示并上报原文。
 */
export function formatServerAuthError(
  t: TFunction,
  result: { code?: string; error?: string },
  fallbackKey = "auth.errors.unknown",
): string {
  let key = result.code ? SERVER_CODE_KEYS[result.code] : undefined;
  if (!key && result.error) key = messageToKey(result.error) ?? undefined;
  if (!key) key = fallbackKey;
  if (key === "auth.errors.unknown") {
    console.error("[auth] unrecognized server error:", result);
    reportUnknownAuthError(result.error ?? result.code ?? "");
  }
  return t(key);
}
