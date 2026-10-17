"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/** Locale-aware date and size formatting shared by the content components. */
export function useContentFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language?.startsWith("en") ? "en" : "zh-CN";
  return useMemo(() => {
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
    const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const safe = (format: Intl.DateTimeFormat, iso: string) => {
      const value = new Date(iso);
      return Number.isNaN(value.getTime()) ? "—" : format.format(value);
    };
    return {
      date: (iso: string) => safe(date, iso),
      dateTime: (iso: string) => safe(dateTime, iso),
      size: (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 ** 2) return `${number.format(bytes / 1024)} KB`;
        if (bytes < 1024 ** 3) return `${number.format(bytes / 1024 ** 2)} MB`;
        return `${number.format(bytes / 1024 ** 3)} GB`;
      },
    };
  }, [locale]);
}
