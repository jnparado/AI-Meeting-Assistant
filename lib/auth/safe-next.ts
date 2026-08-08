const DEFAULT_AFTER_AUTH = "/dashboard";

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
