/**
 * Validate a post-auth redirect target. Only same-origin relative paths are
 * allowed (must start with a single "/", not "//" and not a protocol) to
 * prevent open-redirect phishing. Falls back to "/" for anything suspicious.
 */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  // must be a root-relative path
  if (!raw.startsWith("/")) return fallback;
  // reject protocol-relative ("//evil.com") and backslash tricks
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // reject anything that smells like an absolute URL
  if (raw.includes("://")) return fallback;
  return raw;
}
