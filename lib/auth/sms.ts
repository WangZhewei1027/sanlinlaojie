"use server";

import Dypnsapi20170525, {
  SendSmsVerifyCodeRequest,
  CheckSmsVerifyCodeRequest,
} from "@alicloud/dypnsapi20170525";
import { Config } from "@alicloud/openapi-client";
import { RuntimeOptions } from "@alicloud/tea-util";
import Credential from "@alicloud/credentials";
import { PHONE_EMAIL_DOMAIN } from "@/lib/phone-email";
import { issueSmsTicket, verifySmsTicket } from "@/lib/auth/sms-ticket.server";
import {
  createUserWithPassword,
  findAuthUserByEmail,
  setUserPassword,
  UserExistsError,
} from "@/lib/auth/users.server";

// ─── 阿里云号码认证服务客户端 ─────────────────────────────────
// 凭证通过默认链读取（环境变量 ALIBABA_CLOUD_ACCESS_KEY_ID /
// ALIBABA_CLOUD_ACCESS_KEY_SECRET 等）。
// 短信签名与模板通过环境变量配置，未配置时回退到默认值。

const SMS_SIGN_NAME = process.env.ALIYUN_SMS_SIGN_NAME || "速通互联验证码";
const SMS_TEMPLATE_CODE = process.env.ALIYUN_SMS_TEMPLATE_CODE || "100001";

function createDypnsClient(): Dypnsapi20170525 {
  const credential = new Credential();
  const config = new Config({ credential });
  config.endpoint = "dypnsapi.aliyuncs.com";
  return new Dypnsapi20170525(config);
}

// 阿里云返回码 → 客户端可翻译的机器码（见 lib/auth/auth-error.ts）
function mapAliyunSendCode(code: string | undefined): string {
  switch (code) {
    case "isv.BUSINESS_LIMIT_CONTROL":
    case "isv.DAY_LIMIT_CONTROL":
    case "isv.MONTH_LIMIT_CONTROL":
      return "sms_rate_limited";
    case "isv.MOBILE_NUMBER_ILLEGAL":
      return "invalid_phone";
    default:
      return "sms_send_failed";
  }
}

// ─── 短信验证码接口 ──────────────────────────────────────────

/**
 * 发送短信验证码（阿里云号码认证服务）
 * phone 格式为不带 + 的纯数字，如 8613800138000
 */
export async function SendSmsVerifyCode(
  phone: string,
): Promise<{ success: boolean; code?: string; error?: string }> {
  // 去掉 + 号前缀，阿里云接口需要纯数字
  const phoneNumber = phone.replace(/^\+/, "");

  try {
    const client = createDypnsClient();
    const request = new SendSmsVerifyCodeRequest({
      phoneNumber,
      countryCode: "86",
      signName: SMS_SIGN_NAME,
      templateCode: SMS_TEMPLATE_CODE,
      templateParam: '{"code":"##code##","min":"5"}',
      codeLength: 6,
      validTime: 300,
    });
    const runtime = new RuntimeOptions({});
    const resp = await client.sendSmsVerifyCodeWithOptions(request, runtime);

    if (resp.body?.code === "OK") {
      return { success: true };
    }

    return {
      success: false,
      code: mapAliyunSendCode(resp.body?.code),
      error: resp.body?.message || "Failed to send SMS",
    };
  } catch (error: unknown) {
    console.error("[SMS] Send error:", error);
    return {
      success: false,
      code: "sms_send_failed",
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

/**
 * 校验短信验证码（阿里云号码认证服务）
 * 通过时返回 ticket，注册 / 重置密码时必须带上它
 */
export async function CheckSmsVerifyCode(
  phone: string,
  code: string,
): Promise<{
  success: boolean;
  ticket?: string;
  code?: string;
  error?: string;
}> {
  const phoneNumber = phone.replace(/^\+/, "");

  try {
    const client = createDypnsClient();
    const request = new CheckSmsVerifyCodeRequest({
      phoneNumber,
      countryCode: "86",
      verifyCode: code,
    });
    const runtime = new RuntimeOptions({});
    const resp = await client.checkSmsVerifyCodeWithOptions(request, runtime);

    if (resp.body?.code === "OK" && resp.body?.model?.verifyResult === "PASS") {
      return { success: true, ticket: issueSmsTicket(phoneToEmail(phone)) };
    }

    // 阿里云对过期/错误的验证码统一返回非 PASS；带 EXPIRE 字样的归为过期
    const aliyunCode = resp.body?.code ?? "";
    return {
      success: false,
      code: /EXPIRE/i.test(aliyunCode) ? "code_expired" : "code_invalid",
      error: resp.body?.message || "Verification failed",
    };
  } catch (error: unknown) {
    console.error("[SMS] Check error:", error);
    return {
      success: false,
      code: "code_invalid",
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

// ─── 手机号注册（服务端）──────────────────────────────────────

/**
 * 将手机号转为唯一邮箱，用作账号的登录邮箱
 * 例如 +8613800138000 → 8613800138000@phone.sanlinlaojie.local
 */
function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@${PHONE_EMAIL_DOMAIN}`;
}

/** 凭证缺失、伪造或过期时的统一返回；前端据此让用户重新获取验证码 */
const TICKET_REJECTED = {
  code: "code_expired",
  error: "SMS verification required",
} as const;

/**
 * 通过手机号重置密码
 * 先校验短信验证凭证，再根据虚拟邮箱找到用户并更新密码
 */
export async function resetPasswordByPhone(params: {
  phone: string;
  newPassword: string;
  ticket: string;
}): Promise<{ success: boolean; code?: string; error?: string }> {
  const { phone, newPassword, ticket } = params;
  const email = phoneToEmail(phone);
  if (!verifySmsTicket(ticket, email)) {
    return { success: false, ...TICKET_REJECTED };
  }

  try {
    const user = await findAuthUserByEmail(email);
    if (!user) {
      return { success: false, code: "user_not_found", error: "User not found" };
    }
    await setUserPassword(user.id, newPassword);
    return { success: true };
  } catch (error) {
    console.error("[SMS] reset password error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Reset failed",
    };
  }
}

export async function createUserByPhone(params: {
  phone: string;
  password: string;
  ticket: string;
}): Promise<{
  userId: string | null;
  email: string;
  code?: string;
  error?: string;
}> {
  const { phone, password, ticket } = params;
  const email = phoneToEmail(phone);
  if (!verifySmsTicket(ticket, email)) {
    return { userId: null, email, ...TICKET_REJECTED };
  }

  try {
    const { id } = await createUserWithPassword({
      email,
      password,
      emailVerified: true,
    });
    return { userId: id, email };
  } catch (error) {
    if (error instanceof UserExistsError) {
      return { userId: null, email, code: "user_exists", error: error.message };
    }
    console.error("[SMS] create user error:", error);
    return {
      userId: null,
      email,
      error: error instanceof Error ? error.message : "Sign-up failed",
    };
  }
}
