import { parseServiceAccountKey } from "../search-console/google-auth";
import type { SecretKey } from "./secrets.contract";

// Kiểm tra và chuẩn hóa giá trị trước khi mã hóa: chỉ lưu đúng thứ cần dùng và dựng "gợi ý" không bí mật để hiển thị lại.

export class SecretValidationError extends Error {
  /** Biến bị từ chối (để biểu mẫu chỉ đúng ô nhập sai khi lưu nhiều biến một lần). */
  readonly key?: SecretKey;
  constructor(message: string, key?: SecretKey) {
    super(message);
    this.name = "SecretValidationError";
    this.key = key;
  }
}

export type NormalizedSecret = { value: string; hint: string };

const propertyPattern = /^(sc-domain:[a-z0-9]([a-z0-9.-]*[a-z0-9])?|https?:\/\/[^\s/]+(\/[^\s]*)?\/)$/i;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const normalizers: Record<SecretKey, (raw: string) => NormalizedSecret> = {
  // Tệp khóa JSON của Google: chỉ giữ client_email và private_key (bỏ các trường khác), hiển thị lại email vì nó không bí mật.
  google_service_account(raw) {
    let key: ReturnType<typeof parseServiceAccountKey>;
    try { key = parseServiceAccountKey(raw); } catch (error) { throw new SecretValidationError(error instanceof Error ? error.message : "Tệp khóa không hợp lệ."); }
    return { value: JSON.stringify({ type: "service_account", client_email: key.clientEmail, private_key: key.privateKey }), hint: key.clientEmail };
  },
  search_console_property(raw) {
    const value = raw.trim();
    if (!propertyPattern.test(value) || value.length > 200) throw new SecretValidationError("Thuộc tính không hợp lệ. Dùng dạng sc-domain:ten-mien.vn hoặc https://ten-mien.vn/ (kết thúc bằng dấu /).");
    return { value, hint: value };
  },
  umami_api_url(raw) {
    const value = raw.trim().replace(/\/+$/, "");
    let url: URL | undefined;
    try { url = new URL(value); } catch { url = undefined; }
    if (!url || !/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/" || value.length > 200) throw new SecretValidationError("Địa chỉ không hợp lệ. Dùng dạng http://umami:3000 hoặc https://thongke.ten-mien.vn (không kèm đường dẫn, không có tên đăng nhập).");
    return { value, hint: value };
  },
  umami_website_id(raw) {
    const value = raw.trim().toLowerCase();
    if (!uuidPattern.test(value)) throw new SecretValidationError("Mã website không hợp lệ: cần dạng UUID, ví dụ 3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f.");
    return { value, hint: value };
  },
  umami_api_key(raw) {
    const value = raw.trim();
    if (value.length < 8 || value.length > 500 || /\s/.test(value)) throw new SecretValidationError("API key không hợp lệ: cần 8–500 ký tự, không có khoảng trắng.");
    return { value, hint: `••••${value.slice(-4)}` };
  },
  google_oauth_client_id(raw) {
    const value = raw.trim();
    if (!/^[A-Za-z0-9._-]{10,200}\.apps\.googleusercontent\.com$/.test(value)) throw new SecretValidationError("Client ID không hợp lệ: cần dạng 123456789-abc.apps.googleusercontent.com.");
    return { value, hint: value };
  },
  google_oauth_client_secret(raw) {
    const value = raw.trim();
    if (value.length < 8 || value.length > 200 || /\s/.test(value)) throw new SecretValidationError("Client secret không hợp lệ: cần 8–200 ký tự, không có khoảng trắng.");
    return { value, hint: `••••${value.slice(-4)}` };
  },
  gmail_refresh_token(raw) {
    const value = raw.trim();
    if (value.length < 20 || value.length > 2000 || /\s/.test(value)) throw new SecretValidationError("Token làm mới không hợp lệ.");
    return { value, hint: "Đã kết nối" };
  },
};

export function normalizeSecret(key: SecretKey, raw: string) {
  return normalizers[key](raw);
}
