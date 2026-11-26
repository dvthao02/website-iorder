import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { googleTokenUrl } from "../search-console/google-auth";
import { buildAuthorizationUrl, createPkcePair, emailFromIdToken, exchangeAuthorizationCode, gmailSendScope, gmailSendUrl, GoogleOAuthError, refreshAccessToken, revokeGoogleToken, sendGmailMessage } from "./gmail.google";

const idToken = (claims: Record<string, unknown>) => ["h", Buffer.from(JSON.stringify(claims)).toString("base64url"), "s"].join(".");

type Call = { url: string; init: RequestInit };
function fakeFetch(respond: (call: Call) => Response | Error) {
  const calls: Call[] = [];
  const fetchFn = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    const result = respond(call);
    if (result instanceof Error) throw result;
    return result;
  }) as typeof fetch;
  return { fetchFn, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const formOf = (call: Call) => Object.fromEntries(new URLSearchParams(String(call.init.body)));

test("PKCE: challenge là SHA-256 của verifier (base64url), mỗi lần một cặp mới", () => {
  const first = createPkcePair();
  assert.equal(first.challenge, createHash("sha256").update(first.verifier).digest("base64url"));
  assert.match(first.verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.notEqual(createPkcePair().verifier, first.verifier);
});

test("Địa chỉ cấp quyền: chỉ xin quyền gửi thư và email, offline + consent, có state và PKCE, không lộ client secret", () => {
  const url = new URL(buildAuthorizationUrl({ clientId: "abc.apps.googleusercontent.com", redirectUri: "https://cms.example.vn/admin/integrations/gmail/callback", state: "st", challenge: "ch" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  const params = url.searchParams;
  assert.equal(params.get("client_id"), "abc.apps.googleusercontent.com");
  assert.equal(params.get("redirect_uri"), "https://cms.example.vn/admin/integrations/gmail/callback");
  assert.equal(params.get("response_type"), "code");
  assert.deepEqual(params.get("scope")?.split(" "), ["openid", "email", gmailSendScope]);
  assert.equal(params.get("access_type"), "offline");
  assert.equal(params.get("prompt"), "consent");
  assert.equal(params.get("state"), "st");
  assert.equal(params.get("code_challenge"), "ch");
  assert.equal(params.get("code_challenge_method"), "S256");
  assert.ok(!url.search.includes("secret"));
});

test("Email lấy từ id_token: chỉ nhận email đã xác minh, chuỗi hỏng thì null", () => {
  assert.equal(emailFromIdToken(idToken({ email: "Nguoi.Dung@Gmail.com", email_verified: true })), "nguoi.dung@gmail.com");
  assert.equal(emailFromIdToken(idToken({ email: "a@gmail.com", email_verified: false })), null);
  assert.equal(emailFromIdToken(idToken({ sub: "1" })), null);
  assert.equal(emailFromIdToken("khong-phai-jwt"), null);
  assert.equal(emailFromIdToken(undefined), null);
});

test("Đổi mã cấp quyền lấy token: gửi đúng tham số (kèm code_verifier) và trả token làm mới cùng email", async () => {
  const { fetchFn, calls } = fakeFetch(() => json({ access_token: "at", refresh_token: "rt-xxxxxxxxxxxxxxxxxxxx", scope: `openid email ${gmailSendScope}`, id_token: idToken({ email: "me@gmail.com", email_verified: true }) }));
  const result = await exchangeAuthorizationCode(fetchFn, { clientId: "cid", clientSecret: "csecret", redirectUri: "https://cms/x", code: "the-code", verifier: "ver" });
  assert.deepEqual(result, { refreshToken: "rt-xxxxxxxxxxxxxxxxxxxx", email: "me@gmail.com" });
  assert.equal(calls[0].url, googleTokenUrl);
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(formOf(calls[0]), { grant_type: "authorization_code", code: "the-code", redirect_uri: "https://cms/x", client_id: "cid", client_secret: "csecret", code_verifier: "ver" });
});

test("Bỏ tick quyền gửi thư ở màn Google thì báo thiếu quyền; không có token làm mới thì báo rõ", async () => {
  const token = idToken({ email: "me@gmail.com", email_verified: true });
  const input = { clientId: "c", clientSecret: "s", redirectUri: "https://cms/x", code: "c", verifier: "v" };
  await assert.rejects(exchangeAuthorizationCode(fakeFetch(() => json({ refresh_token: "r".repeat(30), scope: "openid email", id_token: token })).fetchFn, input), (error: unknown) => error instanceof GoogleOAuthError && error.code === "SCOPE_MISSING");
  await assert.rejects(exchangeAuthorizationCode(fakeFetch(() => json({ scope: `openid email ${gmailSendScope}`, id_token: token })).fetchFn, input), (error: unknown) => error instanceof GoogleOAuthError && error.code === "NO_REFRESH_TOKEN");
  await assert.rejects(exchangeAuthorizationCode(fakeFetch(() => json({ refresh_token: "r".repeat(30), scope: `openid email ${gmailSendScope}` })).fetchFn, input), (error: unknown) => error instanceof GoogleOAuthError && error.code === "BAD_RESPONSE");
});

test("Google từ chối (invalid_grant, invalid_client) và lỗi mạng đều thành GoogleOAuthError có mã, không lộ mã cấp quyền", async () => {
  const input = { clientId: "c", clientSecret: "s", redirectUri: "https://cms/x", code: "ma-bi-mat", verifier: "v" };
  const denied = await exchangeAuthorizationCode(fakeFetch(() => json({ error: "invalid_grant", error_description: "Bad Request" }, 400)).fetchFn, input).catch((error: unknown) => error);
  assert.ok(denied instanceof GoogleOAuthError && denied.code === "invalid_grant" && denied.status === 400);
  assert.ok(!denied.message.includes("ma-bi-mat"));
  const offline = await exchangeAuthorizationCode(fakeFetch(() => new Error("ECONNRESET")).fetchFn, input).catch((error: unknown) => error);
  assert.ok(offline instanceof GoogleOAuthError && offline.code === "NETWORK");
});

test("Làm mới access token: gửi refresh_token, trả token và thời hạn; invalid_grant giữ nguyên mã", async () => {
  const ok = fakeFetch(() => json({ access_token: "at-1", expires_in: 3599 }));
  assert.deepEqual(await refreshAccessToken(ok.fetchFn, { clientId: "c", clientSecret: "s", refreshToken: "rt" }), { accessToken: "at-1", expiresInSeconds: 3599 });
  assert.deepEqual(formOf(ok.calls[0]), { grant_type: "refresh_token", refresh_token: "rt", client_id: "c", client_secret: "s" });
  const revoked = await refreshAccessToken(fakeFetch(() => json({ error: "invalid_grant" }, 400)).fetchFn, { clientId: "c", clientSecret: "s", refreshToken: "rt" }).catch((error: unknown) => error);
  assert.ok(revoked instanceof GoogleOAuthError && revoked.code === "invalid_grant");
});

test("Gửi thư: POST tới Gmail API kèm Bearer và raw; 401 thành UNAUTHENTICATED để nơi gọi làm mới token", async () => {
  const ok = fakeFetch(() => json({ id: "m1" }));
  await sendGmailMessage(ok.fetchFn, "tok", "cmF3");
  assert.equal(ok.calls[0].url, gmailSendUrl);
  assert.deepEqual(ok.calls[0].init.headers, { authorization: "Bearer tok", "content-type": "application/json" });
  assert.deepEqual(JSON.parse(String(ok.calls[0].init.body)), { raw: "cmF3" });
  const expired = await sendGmailMessage(fakeFetch(() => json({ error: { message: "Invalid Credentials", status: "UNAUTHENTICATED" } }, 401)).fetchFn, "tok", "x").catch((error: unknown) => error);
  assert.ok(expired instanceof GoogleOAuthError && expired.code === "UNAUTHENTICATED" && expired.status === 401);
  const denied = await sendGmailMessage(fakeFetch(() => json({ error: { message: "Gmail API has not been used", status: "PERMISSION_DENIED" } }, 403)).fetchFn, "tok", "x").catch((error: unknown) => error);
  assert.ok(denied instanceof GoogleOAuthError && denied.code === "PERMISSION_DENIED");
});

test("Thu hồi token: gọi endpoint revoke, lỗi mạng chỉ trả false", async () => {
  const ok = fakeFetch(() => json({}));
  assert.equal(await revokeGoogleToken(ok.fetchFn, "rt"), true);
  assert.deepEqual(formOf(ok.calls[0]), { token: "rt" });
  assert.equal(await revokeGoogleToken(fakeFetch(() => new Error("down")).fetchFn, "rt"), false);
});
