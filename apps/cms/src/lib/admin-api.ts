// Backend errors use { error: { code, message } }. Anything else (HTML from a
// proxy, empty body, non-string message) falls back to a fixed Vietnamese text.
export function apiErrorMessage(payload: unknown, fallback: string) {
  const error = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
  return error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message
    ? error.message
    : fallback;
}

export async function requestAdminJson(url: string, method: "PATCH" | "POST", body: unknown, fallbackError: string): Promise<unknown> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiErrorMessage(payload, fallbackError));
  return payload;
}
