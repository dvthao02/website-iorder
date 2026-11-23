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

/** Phần "error" nguyên văn của phản hồi lỗi (ví dụ { code, message, key }) để màn hình đọc thêm trường riêng của nó. */
function apiErrorDetails(payload: unknown): Record<string, unknown> | undefined {
  const error = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
  return error && typeof error === "object" && !Array.isArray(error) ? error as Record<string, unknown> : undefined;
}

export class AdminApiError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "AdminApiError";
  }
}

export const upstreamUnavailableMessage = "Máy chủ đang gặp sự cố hoặc mất kết nối tạm thời. Phần bạn đang soạn vẫn còn trên màn hình; hãy thử lại sau ít phút.";

/**
 * Đọc JSON từ phản hồi mà không văng lỗi kỹ thuật khi máy chủ/proxy trả trang lỗi dạng chữ
 * (ví dụ "Internal Server Error" lúc Backend mất kết nối). Lỗi 5xx không có JSON được đổi thành
 * thông báo tiếng Việt chuẩn; các trường hợp khác trả null để màn hình dùng thông báo riêng của nó.
 */
export async function readAdminJson(response: Response): ReturnType<Response["json"]> {
  const payload: unknown = await response.json().catch(() => null);
  if (payload === null && response.status >= 500) return { error: { code: "UPSTREAM_UNAVAILABLE", message: upstreamUnavailableMessage } };
  return payload;
}

// Khung CMS nghe sự kiện này để hiện thanh "Tải bản mới nhất" khi người khác vừa lưu cùng nội dung.
export const versionConflictEvent = "iorder:version-conflict";

/** Lỗi chuẩn từ phản hồi API thất bại; xung đột phiên bản (409) còn báo cho khung CMS. */
export function adminApiError(payload: unknown, fallback: string, status?: number) {
  const code = apiErrorCode(payload);
  if (code === "VERSION_CONFLICT" && typeof window !== "undefined") window.dispatchEvent(new Event(versionConflictEvent));
  return new AdminApiError(apiErrorMessage(payload, fallback), code, status, apiErrorDetails(payload));
}

export type AdminJsonMethod = "GET" | "PATCH" | "POST" | "PUT" | "DELETE";

/**
 * Gọi API CMS bằng yêu cầu bất kỳ (kể cả tải tệp lên bằng FormData) và trả về JSON đã đọc an toàn; phản hồi lỗi được ném
 * thành AdminApiError (có mã, trạng thái HTTP và phần "error" nguyên văn). Lỗi mạng (fetch ném) để nguyên cho nơi gọi.
 */
export async function requestAdmin(url: string, init: RequestInit, fallbackError: string): Promise<unknown> {
  const response = await fetch(url, { ...init, headers: { accept: "application/json", ...init.headers } });
  const payload: unknown = await readAdminJson(response);
  if (!response.ok) throw adminApiError(payload, fallbackError, response.status);
  return payload;
}

/** GET/POST/PUT/PATCH/DELETE với thân JSON tùy chọn (body undefined thì không gửi thân và không đặt content-type). */
export function requestAdminJson(url: string, method: AdminJsonMethod, body: unknown, fallbackError: string, options: { cache?: RequestCache } = {}): Promise<unknown> {
  return requestAdmin(url, {
    method,
    ...(options.cache ? { cache: options.cache } : {}),
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  }, fallbackError);
}
