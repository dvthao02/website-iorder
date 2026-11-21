import { createSign } from "node:crypto";

import { tokenResponseSchema } from "./search-console.contract";

// Đăng nhập Google bằng tài khoản dịch vụ (service account): ký JWT RS256 bằng khóa riêng rồi đổi lấy mã truy cập ngắn hạn.
// Dùng sẵn node:crypto nên không thêm thư viện. Địa chỉ Google là hằng số, không lấy từ tệp khóa hay đầu vào nào, nên không có đường để
// dẫn máy chủ gọi tới nơi khác. Khóa riêng và mã truy cập không bao giờ được ghi vào nhật ký hay thông báo lỗi.

export const googleTokenUrl = "https://oauth2.googleapis.com/token";
export const searchConsoleScope = "https://www.googleapis.com/auth/webmasters.readonly";

export type ServiceAccountKey = { clientEmail: string; privateKey: string };

/** Đọc tệp khóa JSON tải từ Google Cloud. Lỗi chỉ nói chung, không lặp lại nội dung đã đọc (có thể là khóa). */
export function parseServiceAccountKey(raw: string): ServiceAccountKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Khóa tài khoản dịch vụ không phải JSON hợp lệ. Cần đúng tệp JSON tải từ Google Cloud.");
  }
  const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  const clientEmail = typeof record.client_email === "string" ? record.client_email.trim() : "";
  const privateKey = typeof record.private_key === "string" ? record.private_key : "";
  if (!clientEmail || !/BEGIN [A-Z ]*PRIVATE KEY/.test(privateKey)) throw new Error("Khóa tài khoản dịch vụ thiếu client_email hoặc private_key. Cần đúng tệp JSON tải từ Google Cloud.");
  return { clientEmail, privateKey };
}

const base64Url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

/** JWT assertion theo luồng "JWT bearer" của Google: hiệu lực 1 giờ, scope chỉ đọc. */
export function signServiceAccountJwt(key: ServiceAccountKey, nowSeconds: number, scope = searchConsoleScope) {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({ iss: key.clientEmail, scope, aud: googleTokenUrl, iat: nowSeconds, exp: nowSeconds + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${signer.sign(key.privateKey).toString("base64url")}`;
}

export class GoogleAuthError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

type TokenProviderDependencies = { fetch: typeof fetch; now: () => Date; key: ServiceAccountKey; timeoutMilliseconds?: number };

/** Hàm lấy mã truy cập: giữ mã trong bộ nhớ đến gần hết hạn, nhiều yêu cầu cùng lúc dùng chung một lần đổi mã. */
export function createTokenProvider({ fetch: fetcher, now, key, timeoutMilliseconds = 8_000 }: TokenProviderDependencies) {
  let cached: { token: string; expiresAt: number } | undefined;
  let pending: Promise<string> | undefined;

  async function exchange() {
    const assertion = signServiceAccountJwt(key, Math.floor(now().getTime() / 1000));
    let response: Response;
    try {
      response = await fetcher(googleTokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
    } catch {
      throw new GoogleAuthError("Không kết nối được máy chủ đăng nhập của Google.");
    }
    if (!response.ok) throw new GoogleAuthError(`Google từ chối khóa tài khoản dịch vụ (HTTP ${response.status}). Kiểm tra khóa còn hiệu lực và đã bật Google Search Console API.`, response.status);
    const body = tokenResponseSchema.safeParse(await response.json().catch(() => null));
    if (!body.success) throw new GoogleAuthError("Google trả phản hồi đăng nhập không hợp lệ.");
    cached = { token: body.data.access_token, expiresAt: now().getTime() + body.data.expires_in * 1000 };
    return cached.token;
  }

  return async function getToken() {
    // Còn hiệu lực ít nhất 1 phút thì dùng lại.
    if (cached && cached.expiresAt - now().getTime() > 60_000) return cached.token;
    pending ??= exchange().finally(() => { pending = undefined; });
    return pending;
  };
}
