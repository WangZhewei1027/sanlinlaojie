/** Mainland China mobile numbers, stored without the +86 country code. */
export function normalizeChinaPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/[\s-]/g, "");
  const match = /^(?:\+?86)?(1[3-9]\d{9})$/.exec(compact);
  return match?.[1] ?? null;
}
