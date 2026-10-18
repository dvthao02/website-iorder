// Backend errors use { error: { code, message } }. Anything else (HTML from a
// proxy, empty body, non-string message) falls back to a fixed Vietnamese text.
export function apiErrorMessage(payload: unknown, fallback: string) {
  const error = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
  return error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message
    ? error.message
    : fallback;
}

export function apiErrorCode(payload: unknown) {
  const error = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

export class AdminApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "AdminApiError";
  }
}

// Khung CMS nghe sự kiện này để hiện thanh "Tải bản mới nhất" khi người khác vừa lưu cùng nội dung.
export const versionConflictEvent = "iorder:version-conflict";

/** Lỗi chuẩn từ phản hồi API thất bại; xung đột phiên bản (409) còn báo cho khung CMS. */
export function adminApiError(payload: unknown, fallback: string) {
  const code = apiErrorCode(payload);
  if (code === "VERSION_CONFLICT" && typeof window !== "undefined") window.dispatchEvent(new Event(versionConflictEvent));
  return new AdminApiError(apiErrorMessage(payload, fallback), code);
}

export async function requestAdminJson(url: string, method: "PATCH" | "POST", body: unknown, fallbackError: string): Promise<unknown> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw adminApiError(payload, fallbackError);
  return payload;
}
