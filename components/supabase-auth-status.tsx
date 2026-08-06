type Props = {
  configured: boolean;
  projectUrl: string | null;
};

export function SupabaseAuthStatus({ configured, projectUrl }: Props) {
  if (!configured) {
    return (
      <div
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        role="alert"
      >
        Supabase is not configured. Add{" "}
        <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
        <code className="text-xs">.env.local</code>, then restart{" "}
        <code className="text-xs">npm run dev</code>.
      </div>
    );
  }

  let host = "Connected";
  if (projectUrl) {
    try {
      host = new URL(projectUrl).hostname;
    } catch {
      host = projectUrl;
    }
  }

  return (
    <p className="text-center text-xs text-muted-foreground" role="status">
      Supabase Auth · <span className="font-medium text-foreground">{host}</span>
    </p>
  );
}
