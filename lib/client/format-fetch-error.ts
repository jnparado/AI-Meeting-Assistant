/** Network errors from fetch (Safari: "Load failed") with a clearer message. */
export function formatFetchError(err: unknown): string {
  if (err instanceof TypeError) {
    return "Cannot reach the server. Run npm run dev locally, then refresh this page.";
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Request failed";
}
