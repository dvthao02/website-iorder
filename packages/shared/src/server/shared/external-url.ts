/**
 * Kiểm link tải về ngoài (https). Module thuần, không dùng API của Node, nên hợp đồng dữ liệu và giao diện quản trị (chạy trên trình duyệt)
 * import được; phần tải tệp thật (cần Node) nằm ở remote-file.ts.
 */

export type RemoteFileErrorCode = "invalid_url" | "blocked" | "unreachable" | "timeout" | "http_status" | "too_large" | "too_many_redirects";

export class RemoteFileError extends Error {
  constructor(readonly code: RemoteFileErrorCode, message: string, readonly status?: number) {
    super(message);
    this.name = "RemoteFileError";
  }
}

export const maxExternalUrlLength = 1000;

/** Chuẩn hóa và kiểm link tải về: https, có tên máy chủ, không tài khoản/mật khẩu, không quá dài. Ném `RemoteFileError("invalid_url")` nếu sai. */
export function parseExternalHttpsUrl(input: string): URL {
  const text = input.trim();
  if (!text || text.length > maxExternalUrlLength) throw new RemoteFileError("invalid_url", `Link không được để trống hoặc dài quá ${maxExternalUrlLength} ký tự.`);
  let url: URL;
  try { url = new URL(text); } catch { throw new RemoteFileError("invalid_url", "Link không hợp lệ. Nhập địa chỉ đầy đủ, ví dụ https://…"); }
  if (url.protocol !== "https:") throw new RemoteFileError("invalid_url", "Chỉ nhận link bắt đầu bằng https:// để tải về an toàn.");
  if (url.username || url.password) throw new RemoteFileError("invalid_url", "Link không được kèm tài khoản hoặc mật khẩu.");
  if (!url.hostname) throw new RemoteFileError("invalid_url", "Link thiếu tên máy chủ.");
  return url;
}

/** Thông báo lỗi tiếng Việt nếu link sai, `null` nếu hợp lệ (dùng cho schema và giao diện). */
export function externalUrlProblem(input: string): string | null {
  try { parseExternalHttpsUrl(input); return null; } catch (error) { return error instanceof Error ? error.message : "Link không hợp lệ."; }
}
