"use client";

import { useEffect } from "react";
import "@/lib/i18n/config";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 确保 i18n 已初始化
  }, []);

  return <>{children}</>;
}
