"use client";

import { useEffect, useState } from "react";
import i18n from "@/lib/i18n/config";
import {
  LANGUAGE_COOKIE,
  resolveLanguage,
  type Language,
} from "@/lib/i18n/settings";

/** 切换语言并持久化(cookie 供 SSR 读取,localStorage 兼容旧版本)。 */
export function applyLanguage(lng: Language) {
  i18n.changeLanguage(lng);
  document.cookie = `${LANGUAGE_COOKIE}=${lng};path=/;max-age=31536000;SameSite=Lax`;
  localStorage.setItem("language", lng);
  document.documentElement.lang = lng;
}

export function I18nProvider({
  lang,
  children,
}: {
  lang: Language;
  children: React.ReactNode;
}) {
  // useState 初始化器在首帧渲染前同步执行(SSR 与客户端都会走到),
  // 保证两端首帧用同一语言,避免水合失败
  useState(() => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  });

  useEffect(() => {
    // <html lang> 在布局里是静态默认值,挂载后校正为真实语言
    document.documentElement.lang = lang;

    // 一次性迁移:老用户的语言偏好只存在 localStorage、还没有 cookie
    const hasCookie = new RegExp(`(^|; )${LANGUAGE_COOKIE}=`).test(
      document.cookie
    );
    const saved = localStorage.getItem("language");
    if (!hasCookie && saved) {
      applyLanguage(resolveLanguage(saved));
    }
  }, [lang]);

  return <>{children}</>;
}
