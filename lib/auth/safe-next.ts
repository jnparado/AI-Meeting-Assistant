export const DEFAULT_AFTER_AUTH = "/dashboard/meetings";

/** Allow only same-origin relative paths (no protocol-relative URLs). */
export function safeNextPath(
  value: string | null | undefined,
  fallback = DEFAULT_AFTER_AUTH,
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }
  return trimmed;
}

export function authPathWithNext(
  basePath: "/login" | "/signup",
  next?: string | null,
): string {
  const safe = safeNextPath(next);
  return `${basePath}?next=${encodeURIComponent(safe)}`;
}

/** Prefill login email after sign-out (basic validation only). */
export function safeEmailParam(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "";
  }
  return trimmed;
}
