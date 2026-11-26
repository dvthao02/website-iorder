import type { SecretKey } from "../secrets/secrets.contract";
import { gmailCallbackPath, gmailSettingsUpdateSchema, type GmailConnection, type GmailStatus } from "./gmail.contract";
import { buildAuthorizationUrl, createPkcePair, exchangeAuthorizationCode, GoogleOAuthError, refreshAccessToken, revokeGoogleToken, sendGmailMessage } from "./gmail.google";
import { composeLeadMail, type LeadMailInput } from "./gmail.lead-mail";
import { buildMimeMessage, toBase64Url } from "./gmail.mime";
import { createPendingConnections } from "./gmail.pending";
import type { GmailRepository } from "./gmail.repository";

// Gmail báo liên hệ mới: kết nối tài khoản Gmail bằng OAuth (bấm Kết nối, Google cấp quyền) rồi gửi thư mỗi khi có liên hệ mới, kèm danh sách CC.
// Dịch vụ nhận phụ thuộc từ ngoài (kho cài đặt, kho khóa, fetch, đồng hồ) để kiểm thử mà không cần Google hay database.

export type GmailErrorCode = "CLIENT_MISSING" | "INVALID_REDIRECT" | "STATE_INVALID" | "NOT_CONNECTED" | "NEEDS_RECONNECT" | "GOOGLE_ERROR";

export class GmailError extends Error {
  constructor(message: string, readonly code: GmailErrorCode) {
    super(message);
    this.name = "GmailError";
  }
}

export type GmailDependencies = {
  repository: GmailRepository;
  secrets: {
    get(key: SecretKey): Promise<string | undefined>;
    put(input: { userId: string; key: SecretKey; value: string }): Promise<void>;
    remove(input: { userId: string; key: SecretKey }): Promise<void>;
    verifyPassword(input: { userId: string; password: string }): Promise<void>;
  };
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  now: () => Date;
  log: (message: string, context?: Record<string, unknown>) => void;
  pending?: ReturnType<typeof createPendingConnections>;
};

/** Tối đa 20 thư báo trong 10 phút: bot vượt được các lớp chống spam cũng không biến hộp thư thành nơi nhận hàng trăm thư. Liên hệ vẫn được lưu đầy đủ. */
const leadMailLimit = { max: 20, windowMs: 10 * 60 * 1000 };
const refreshMarginMs = 60_000;

export type NotifyResult = { sent: true } | { sent: false; reason: "disabled" | "not_connected" | "rate_limited" | "error" };

const friendlyOAuthError: Record<string, string> = {
  invalid_client: "Google không nhận Client ID hoặc Client secret. Kiểm tra lại hai giá trị ở thẻ “Gmail (gửi thư báo liên hệ mới)”.",
  unauthorized_client: "Google không cho Client ID này xin quyền. Kiểm tra loại ứng dụng phải là Web application.",
  redirect_uri_mismatch: "Địa chỉ quay lại chưa được đăng ký ở Google Cloud (mục Authorized redirect URIs).",
  invalid_grant: "Mã cấp quyền đã dùng hoặc hết hạn. Bấm Kết nối Gmail lại.",
};

function describe(error: unknown) {
  if (error instanceof GmailError) return error.message;
  if (error instanceof GoogleOAuthError) return friendlyOAuthError[error.code] ?? error.message;
  return "Lỗi không xác định khi gửi thư.";
}

export function createGmailService(deps: GmailDependencies) {
  const pending = deps.pending ?? createPendingConnections({ now: () => deps.now().getTime() });
  const nowMs = () => deps.now().getTime();
  let cachedAccessToken: { value: string; expiresAt: number } | null = null;
  const sentTimes: number[] = [];

  async function clientCredentials() {
    const clientId = deps.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || await deps.secrets.get("google_oauth_client_id");
    const clientSecret = deps.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || await deps.secrets.get("google_oauth_client_secret");
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }

  async function getStatus(): Promise<GmailStatus> {
    const [{ settings, version }, connection, client] = await Promise.all([deps.repository.readSettings(), deps.repository.readConnection(), clientCredentials()]);
    return { clientConfigured: Boolean(client), connection, settings, version, callbackPath: gmailCallbackPath };
  }

  /** Google chỉ nhận địa chỉ quay lại là https (hoặc http trên localhost) và phải trùng đúng địa chỉ đã đăng ký; ở đây chặn dạng sai trước khi gửi sang Google. */
  function validateRedirectUri(raw: string) {
    let url: URL | undefined;
    try { url = new URL(raw); } catch { url = undefined; }
    const local = url?.hostname === "localhost" || url?.hostname === "127.0.0.1";
    const secure = url?.protocol === "https:" || (url?.protocol === "http:" && local);
    if (!url || !secure || url.pathname !== gmailCallbackPath || url.search || url.hash || url.username || url.password) {
      throw new GmailError(`Địa chỉ quay lại không hợp lệ. Hãy mở CMS bằng địa chỉ https (hoặc localhost); đường dẫn phải là ${gmailCallbackPath}.`, "INVALID_REDIRECT");
    }
    return url;
  }

  async function startConnect(input: { userId: string; password: string; redirectUri: string }) {
    const redirect = validateRedirectUri(input.redirectUri);
    const client = await clientCredentials();
    if (!client) throw new GmailError("Chưa có Client ID và Client secret. Điền ở thẻ “Gmail (gửi thư báo liên hệ mới)” trước.", "CLIENT_MISSING");
    await deps.secrets.verifyPassword({ userId: input.userId, password: input.password });
    const { verifier, challenge } = createPkcePair();
    const state = pending.create({ userId: input.userId, redirectUri: redirect.toString(), verifier });
    return { authUrl: buildAuthorizationUrl({ clientId: client.clientId, redirectUri: redirect.toString(), state, challenge }) };
  }

  async function finishConnect(input: { userId: string; code: string; state: string }): Promise<GmailConnection> {
    const connecting = pending.consume(input.state, input.userId);
    if (!connecting) throw new GmailError("Phiên kết nối đã hết hạn hoặc không hợp lệ. Bấm Kết nối Gmail lại.", "STATE_INVALID");
    const client = await clientCredentials();
    if (!client) throw new GmailError("Chưa có Client ID và Client secret.", "CLIENT_MISSING");
    let granted: { refreshToken: string; email: string };
    try {
      granted = await exchangeAuthorizationCode(deps.fetch, { ...client, redirectUri: connecting.redirectUri, code: input.code, verifier: connecting.verifier });
    } catch (error) {
      deps.log("Gmail: không đổi được mã cấp quyền lấy token.", { code: error instanceof GoogleOAuthError ? error.code : "UNKNOWN" });
      throw new GmailError(describe(error), "GOOGLE_ERROR");
    }
    const previous = await deps.secrets.get("gmail_refresh_token");
    await deps.secrets.put({ userId: input.userId, key: "gmail_refresh_token", value: granted.refreshToken });
    cachedAccessToken = null;
    const connection: GmailConnection = { email: granted.email, status: "connected", connectedAt: deps.now().toISOString(), cmsOrigin: new URL(connecting.redirectUri).origin, lastSentAt: null, lastError: null, lastErrorAt: null };
    await deps.repository.saveConnection(connection, input.userId);
    // Kết nối lại cấp token mới: thu hồi token cũ để không còn hai token cùng hiệu lực.
    if (previous && previous !== granted.refreshToken) void revokeGoogleToken(deps.fetch, previous);
    return connection;
  }

  async function disconnect(input: { userId: string; password: string }) {
    await deps.secrets.verifyPassword({ userId: input.userId, password: input.password });
    const token = await deps.secrets.get("gmail_refresh_token");
    if (token) await revokeGoogleToken(deps.fetch, token);
    await deps.secrets.remove({ userId: input.userId, key: "gmail_refresh_token" });
    await deps.repository.removeConnection(input.userId);
    cachedAccessToken = null;
  }

  async function accessToken(client: { clientId: string; clientSecret: string }, refreshToken: string) {
    if (cachedAccessToken && cachedAccessToken.expiresAt - refreshMarginMs > nowMs()) return cachedAccessToken.value;
    const refreshed = await refreshAccessToken(deps.fetch, { ...client, refreshToken });
    cachedAccessToken = { value: refreshed.accessToken, expiresAt: nowMs() + refreshed.expiresInSeconds * 1000 };
    return cachedAccessToken.value;
  }

  /** Gửi một thư từ Gmail đã kết nối tới chính nó, kèm CC. Token truy cập hết hạn giữa chừng (401) thì làm mới và thử lại đúng một lần. */
  async function deliver(input: { connection: GmailConnection; subject: string; text: string; cc: string[] }) {
    if (input.connection.status !== "connected") throw new GmailError("Gmail cần được kết nối lại.", "NEEDS_RECONNECT");
    const client = await clientCredentials();
    if (!client) throw new GmailError("Chưa có Client ID và Client secret.", "CLIENT_MISSING");
    const refreshToken = await deps.secrets.get("gmail_refresh_token");
    if (!refreshToken) throw new GmailError("Gmail cần được kết nối lại.", "NEEDS_RECONNECT");
    const raw = toBase64Url(buildMimeMessage({ from: input.connection.email, to: [input.connection.email], cc: input.cc, subject: input.subject, text: input.text }));
    for (let attempt = 0; ; attempt++) {
      try {
        await sendGmailMessage(deps.fetch, await accessToken(client, refreshToken), raw);
        return;
      } catch (error) {
        if (attempt === 0 && error instanceof GoogleOAuthError && error.code === "UNAUTHENTICATED") { cachedAccessToken = null; continue; }
        throw error;
      }
    }
  }

  /** Ghi lại thất bại để CMS hiện. Google từ chối token (invalid_grant) thì đánh dấu cần kết nối lại. */
  async function recordFailure(error: unknown) {
    const revoked = error instanceof GoogleOAuthError && error.code === "invalid_grant";
    if (revoked) cachedAccessToken = null;
    await deps.repository.patchConnection({
      ...(revoked ? { status: "needs_reconnect" as const } : {}),
      lastError: (revoked ? "Google đã thu hồi quyền hoặc token hết hạn. Bấm Kết nối lại." : describe(error)).slice(0, 300),
      lastErrorAt: deps.now().toISOString(),
    }).catch(() => undefined);
  }

  async function recordSuccess() {
    await deps.repository.patchConnection({ lastSentAt: deps.now().toISOString(), lastError: null, lastErrorAt: null }).catch(() => undefined);
  }

  async function sendTest(userId: string) {
    const [connection, { settings }] = await Promise.all([deps.repository.readConnection(), deps.repository.readSettings()]);
    if (!connection) throw new GmailError("Chưa kết nối Gmail.", "NOT_CONNECTED");
    try {
      await deliver({ connection, cc: settings.cc, subject: "[iOrder] Thư thử từ CMS", text: "Đây là thư thử từ CMS iOrder.\n\nNếu bạn nhận được thư này (và các địa chỉ CC cũng nhận được), Gmail báo liên hệ mới đã hoạt động." });
    } catch (error) {
      await recordFailure(error);
      throw new GmailError(describe(error), error instanceof GmailError ? error.code : "GOOGLE_ERROR");
    }
    await recordSuccess();
    await deps.repository.recordTestSend(userId, 1 + settings.cc.filter((address) => address !== connection.email).length);
    return { to: connection.email, cc: settings.cc.filter((address) => address !== connection.email) };
  }

  async function updateSettings(userId: string, input: unknown) {
    const values = gmailSettingsUpdateSchema.parse(input);
    if (values.enabled && !(await deps.repository.readConnection())) throw new GmailError("Cần kết nối Gmail trước khi bật báo liên hệ mới.", "NOT_CONNECTED");
    await deps.repository.writeSettings({ enabled: values.enabled, cc: values.cc }, userId, values.expectedVersion);
    return getStatus();
  }

  /**
   * Báo một liên hệ mới qua Gmail. KHÔNG BAO GIỜ ném lỗi và không được chặn việc lưu liên hệ: nơi gọi chỉ `void` kết quả.
   * Không có hàng đợi (kiến trúc không dùng queue): thư lỗi được ghi ở trạng thái kết nối để CMS hiện, liên hệ vẫn nằm trong hộp thư liên hệ của CMS.
   */
  async function notifyNewLead(lead: LeadMailInput): Promise<NotifyResult> {
    try {
      const [{ settings }, connection] = await Promise.all([deps.repository.readSettings(), deps.repository.readConnection()]);
      if (!settings.enabled) return { sent: false, reason: "disabled" };
      if (!connection || connection.status !== "connected") return { sent: false, reason: "not_connected" };
      const current = nowMs();
      while (sentTimes.length && current - sentTimes[0] > leadMailLimit.windowMs) sentTimes.shift();
      if (sentTimes.length >= leadMailLimit.max) {
        deps.log("Gmail báo liên hệ mới: đã đạt giới hạn thư trong 10 phút, bỏ qua thư này (liên hệ vẫn được lưu).");
        return { sent: false, reason: "rate_limited" };
      }
      sentTimes.push(current);
      const mail = composeLeadMail(lead, { cmsOrigin: connection.cmsOrigin });
      await deliver({ connection, cc: settings.cc, ...mail });
      await recordSuccess();
      return { sent: true };
    } catch (error) {
      deps.log("Gmail báo liên hệ mới: gửi thư thất bại.", { code: error instanceof GoogleOAuthError || error instanceof GmailError ? error.code : "UNKNOWN" });
      await recordFailure(error);
      return { sent: false, reason: "error" };
    }
  }

  return { getStatus, startConnect, finishConnect, disconnect, sendTest, updateSettings, notifyNewLead };
}
