/** Parse JSON API responses; handles HTML error pages from crashed dev server. */
export async function readJsonResponse(
  res: Response,
): Promise<Record<string, unknown>> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    if (res.status === 401) {
      return { error: "Your session expired. Please sign in again." };
    }
    if (res.status >= 500) {
      return {
        error:
          "Server error — free disk space and restart npm run dev, then try again.",
      };
    }
    return {
      error: `Unexpected server response (${res.status}). Refresh and try again.`,
    };
  }
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return { error: "Could not read server response." };
  }
}
