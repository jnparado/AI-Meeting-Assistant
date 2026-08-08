export function getUserInitials(
  email: string | null | undefined,
  fullName?: string | null,
): string {
  const name = fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    const local = email.split("@")[0] ?? "";
    if (local.length >= 2) return local.slice(0, 2).toUpperCase();
    return local.slice(0, 1).toUpperCase() || "U";
  }
  return "U";
}

export function getUserDisplayLabel(
  email: string | null | undefined,
  fullName?: string | null,
): string {
  const initials = getUserInitials(email, fullName);
  return initials;
}

export function getUserSubtitle(
  fullName?: string | null,
): string {
  if (fullName?.trim()) {
    const first = fullName.trim().split(/\s+/)[0];
    return first ?? "User";
  }
  return "User";
}
