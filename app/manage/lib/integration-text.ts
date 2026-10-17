"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * Locale keys the integration pages need but the shared locale files do not
 * have yet. The sibling UI process owns `locales/*.json`; until it adds these
 * keys, each module ships its own zh/en fallback table and `useIntegrationText`
 * passes the right one as i18next's `defaultValue`. A real locale entry always
 * wins. Every key lives under `contentModel.integration.*` so the coordinator
 * can collect them with one grep.
 */
export type IntegrationTexts = Record<string, readonly [zh: string, en: string]>;

export function useIntegrationText(texts: IntegrationTexts) {
  const { t, i18n } = useTranslation();
  const english = i18n.language?.startsWith("en") ?? false;
  return useCallback(
    (key: string, options?: Record<string, unknown>) => {
      const fallback = texts[key];
      return t(key, { ...options, defaultValue: fallback ? fallback[english ? 1 : 0] : key }) as string;
    },
    [t, texts, english],
  );
}

export type IntegrationT = ReturnType<typeof useIntegrationText>;
