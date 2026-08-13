/** Supabase Dashboard → SQL Editor (new query) for this project. */
export function getSupabaseSqlEditorUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    if (!ref) return null;
    return `https://supabase.com/dashboard/project/${ref}/sql/new`;
  } catch {
    return null;
  }
}
