import { createHash, randomBytes } from "node:crypto";

import { googleTokenUrl } from "../search-console/google-auth";

// Gọi Google cho luồng "Kết nối Gmail": OAuth 2.0 (mã cấp quyền + PKCE), làm mới token và gửi thư qua Gmail API. Nhận `fetch` từ ngoài để kiểm thử
// mà không gọi mạng. Không ghi log và không đưa token hay mã vào thông báo lỗi.

export const googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
export const googleRevokeUrl = "https://oauth2.googleapis.com/revoke";
export const gmailSendUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
/** Chỉ xin quyền GỬI thư (không đọc được hộp thư) và địa chỉ email của tài khoản. */
export const gmailSendScope = "https://www.googleapis.com/auth/gmail.send";
export const gmailScopes = ["openid", "email", gmailSendScope] as const;

const requestTimeoutMs = 15_000;

type FetchFunction = typeof fetch;

/** Lỗi từ Google. `code` là mã OAuth của Google (invalid_grant, invalid_client…) hoặc mã nội bộ (NETWORK, SCOPE_MISSING, NO_REFRESH_TOKEN, BAD_RESPONSE). */
export class GoogleOAuthError extends Error {
  constructor(message: string, readonly code: string, readonly status?: number) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

export function createPkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function buildAuthorizationUrl(input: { clientId: string; redirectUri: string; state: string; challenge: string; loginHint?: string }) {
  const url = new URL(googleAuthUrl);
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: gmailScopes.join(" "),
    // offline + consent: luôn nhận token làm mới (không có consent thì lần kết nối lại có thể không trả token).
    access_type: "offline",
    prompt: "consent",
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
    ...(input.loginHint ? { login_hint: input.loginHint } : {}),
  }).toString();
  return url.toString();
}

/** Lấy email từ id_token. Token nhận thẳng từ Google qua TLS nên chỉ cần đọc phần thân, không cần kiểm chữ ký. */
export function emailFromIdToken(idToken: unknown) {
  if (typeof idToken !== "string") return null;
  try {
    const claims = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: unknown; email_verified?: unknown };
    return typeof claims.email === "string" && claims.email_verified !== false ? claims.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function postForm(fetchFn: FetchFunction, url: string, form: Record<string, string>) {
  let response: Response;
  try {
    response = await fetchFn(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form), signal: AbortSignal.timeout(requestTimeoutMs) });
  } catch {
    throw new GoogleOAuthError("Không kết nối được tới Google.", "NETWORK");
  }
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const code = typeof payload?.error === "string" ? payload.error : "BAD_RESPONSE";
    throw new GoogleOAuthError(typeof payload?.error_description === "string" ? payload.error_description.slice(0, 200) : "Google từ chối yêu cầu.", code, response.status);
  }
  return payload ?? {};
}

export async function exchangeAuthorizationCode(fetchFn: FetchFunction, input: { clientId: string; clientSecret: string; redirectUri: string; code: string; verifier: string }) {
  const payload = await postForm(fetchFn, googleTokenUrl, {
    grant_type: "authorization_code", code: input.code, redirect_uri: input.redirectUri, client_id: input.clientId, client_secret: input.clientSecret, code_verifier: input.verifier,
  });
  const scopes = typeof payload.scope === "string" ? payload.scope.split(/\s+/) : [];
  // Màn cấp quyền của Google cho bỏ tick từng quyền: thiếu quyền gửi thư thì kết nối không có ích.
  if (!scopes.includes(gmailSendScope)) throw new GoogleOAuthError("Bạn chưa cấp quyền gửi thư. Bấm Kết nối lại và giữ nguyên ô “Gửi email thay mặt bạn”.", "SCOPE_MISSING");
  if (typeof payload.refresh_token !== "string" || !payload.refresh_token) throw new GoogleOAuthError("Google không trả token làm mới. Thu hồi quyền của ứng dụng ở myaccount.google.com/permissions rồi kết nối lại.", "NO_REFRESH_TOKEN");
  const email = emailFromIdToken(payload.id_token);
  if (!email) throw new GoogleOAuthError("Google không trả địa chỉ email của tài khoản.", "BAD_RESPONSE");
  return { refreshToken: payload.refresh_token, email };
}

export async function refreshAccessToken(fetchFn: FetchFunction, input: { clientId: string; clientSecret: string; refreshToken: string }) {
  const payload = await postForm(fetchFn, googleTokenUrl, { grant_type: "refresh_token", refresh_token: input.refreshToken, client_id: input.clientId, client_secret: input.clientSecret });
  if (typeof payload.access_token !== "string" || !payload.access_token) throw new GoogleOAuthError("Google không trả access token.", "BAD_RESPONSE");
  const expiresIn = typeof payload.expires_in === "number" && payload.expires_in > 0 ? payload.expires_in : 3_000;
  return { accessToken: payload.access_token, expiresInSeconds: expiresIn };
}

/** Gửi thư thô (base64url). 401 nghĩa là access token hết hạn/hỏng: nơi gọi làm mới rồi thử lại một lần. */
export async function sendGmailMessage(fetchFn: FetchFunction, accessToken: string, raw: string) {
  let response: Response;
  try {
    response = await fetchFn(gmailSendUrl, { method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ raw }), signal: AbortSignal.timeout(requestTimeoutMs) });
  } catch {
    throw new GoogleOAuthError("Không kết nối được tới Gmail.", "NETWORK");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: unknown; status?: unknown } } | null;
    throw new GoogleOAuthError(typeof payload?.error?.message === "string" ? payload.error.message.slice(0, 200) : "Gmail từ chối gửi thư.", response.status === 401 ? "UNAUTHENTICATED" : typeof payload?.error?.status === "string" ? payload.error.status : "GMAIL_ERROR", response.status);
  }
}

/** Thu hồi quyền ở phía Google khi ngắt kết nối. Lỗi bị bỏ qua (token có thể đã hết hạn): quan trọng là CMS xóa token của mình. */
export async function revokeGoogleToken(fetchFn: FetchFunction, token: string) {
  try {
    await fetchFn(googleRevokeUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }), signal: AbortSignal.timeout(requestTimeoutMs) });
    return true;
  } catch {
    return false;
  }
}
