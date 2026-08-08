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
  let projectRef: string | null = null;
  if (projectUrl) {
    try {
      const parsed = new URL(projectUrl);
      host = parsed.hostname;
      projectRef = host.split(".")[0] ?? null;
    } catch {
      host = projectUrl;
    }
  }

  const providersUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/auth/providers`
    : null;

  return (
    <p className="text-center text-xs text-muted-foreground" role="status">
      Supabase Auth ·{" "}
      <span className="font-medium text-foreground">{host}</span>
      {providersUrl && (
        <>
          {" "}
          ·{" "}
          <a
            href={providersUrl}
            className="text-primary underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Providers
          </a>
        </>
      )}
      {projectRef && (
        <span className="mt-1 block text-[0.65rem]">
          Enable Google on this project ref:{" "}
          <code className="text-foreground">{projectRef}</code>
        </span>
      )}
    </p>
  );
}
