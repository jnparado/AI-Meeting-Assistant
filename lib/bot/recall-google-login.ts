import { getRecallApiBase } from "@/lib/bot/recall-config";

export type GoogleLoginGroupLoginMode = "always" | "only_if_required";

export type GoogleLoginGroup = {
  id: string;
  name: string;
  login_mode: GoogleLoginGroupLoginMode;
  created_at: string;
  updated_at: string;
  logins?: GoogleLogin[];
};

export type GoogleLogin = {
  id: string;
  email: string;
  is_active: boolean;
  sso_v2_workspace_domain: string;
  group_id: string;
  created_at: string;
  updated_at: string;
};

export type CreateGoogleLoginGroupInput = {
  name: string;
  login_mode?: GoogleLoginGroupLoginMode;
};

export type CreateGoogleLoginInput = {
  email: string;
  group_id: string;
  sso_v2_workspace_domain: string;
  sso_v2_private_key: string;
  sso_v2_cert: string;
  is_active?: boolean;
};

type Paginated<T> = {
  next: string | null;
  previous: string | null;
  results: T[];
};

async function recallApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const key = process.env.RECALL_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing RECALL_API_KEY");
  }

  const headers: Record<string, string> = {
    Authorization: `Token ${key}`,
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${getRecallApiBase()}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Recall (${res.status}): ${text.slice(0, 500)}`);
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function createGoogleLoginGroup(
  input: CreateGoogleLoginGroupInput,
): Promise<GoogleLoginGroup> {
  return recallApiRequest<GoogleLoginGroup>("/api/v2/google-login-groups/", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      login_mode: input.login_mode ?? "always",
    }),
  });
}

export async function listGoogleLoginGroups(): Promise<GoogleLoginGroup[]> {
  const json = await recallApiRequest<Paginated<GoogleLoginGroup>>(
    "/api/v2/google-login-groups/",
  );
  return json.results ?? [];
}

export async function createGoogleLogin(
  input: CreateGoogleLoginInput,
): Promise<GoogleLogin> {
  return recallApiRequest<GoogleLogin>("/api/v2/google-logins/", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      group_id: input.group_id,
      sso_v2_workspace_domain: input.sso_v2_workspace_domain,
      sso_v2_private_key: input.sso_v2_private_key,
      sso_v2_cert: input.sso_v2_cert,
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
    }),
  });
}
