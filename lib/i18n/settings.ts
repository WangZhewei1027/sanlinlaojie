export const SUPPORTED_LANGUAGES = ["zh", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "zh";
export const LANGUAGE_COOKIE = "language";

export function resolveLanguage(value: string | undefined | null): Language {
  return SUPPORTED_LANGUAGES.includes(value as Language)
    ? (value as Language)
    : DEFAULT_LANGUAGE;
}
