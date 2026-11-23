import { readFile as readFileFromDisk } from "node:fs/promises";

import { logger } from "../shared/logger";
import { createTokenProvider, GoogleAuthError, parseServiceAccountKey, type ServiceAccountKey } from "./google-auth";
import {
  searchAnalyticsResponseSchema, siteListResponseSchema,
  type SearchConsoleDiagnosis, type SearchConsoleOpportunity, type SearchConsoleOverview, type SearchConsolePageQueries, type SearchConsoleQuery, type SearchConsoleTotals,
} from "./search-console.contract";

// Chỉ đọc số liệu tìm kiếm của chính website (Search Analytics) bằng tài khoản dịch vụ được chủ website thêm vào Search Console.
// Không có thao tác nào ghi ngược lên Google. Kết quả được nhớ trong bộ nhớ vài giờ vì Google chỉ cập nhật theo ngày.

const apiBase = "https://www.googleapis.com/webmasters/v3";
const dayMilliseconds = 86_400_000;
const vietnamOffsetMilliseconds = 7 * 3_600_000;
const requestTimeoutMilliseconds = 8_000;
const cacheTtlMilliseconds = 6 * 3_600_000;
const errorTtlMilliseconds = 60_000;
/** Google trả dữ liệu trễ khoảng 2–3 ngày; lấy 28 ngày kết thúc cách hôm nay 3 ngày. */
const dataLagDays = 3;
const periodDays = 28;

// Ngưỡng "cơ hội" theo kinh nghiệm chung, không phải quy tắc của Google.
const minImpressionsNearPageOne = 10;
const minImpressionsLowCtr = 50;
const lowCtr = 0.02;
const maxOpportunities = 10;

export type SearchConsoleDependencies = {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  now: () => Date;
  readFile: (path: string) => Promise<string>;
  /** Địa chỉ website đã khai trong Cài đặt "Tên miền & SEO" (để chọn đúng thuộc tính và dựng địa chỉ trang). */
  siteUrl: () => Promise<string | null | undefined>;
  /**
   * Khóa/thuộc tính Super Admin nhập ở CMS (Cài đặt → Kết nối & khóa API), chỉ dùng khi biến môi trường chưa đặt (biến luôn thắng).
   * Không truyền thì chỉ đọc biến môi trường như trước.
   */
  cmsSecret?: (key: "google_service_account" | "search_console_property") => Promise<string | undefined>;
};

export const defaultReadFile = (path: string) => readFileFromDisk(path, "utf8");

function vietnamDate(instant: number) {
  return new Date(instant + vietnamOffsetMilliseconds).toISOString().slice(0, 10);
}

/** 28 ngày gần nhất có dữ liệu ổn định (kết thúc cách hôm nay 3 ngày). */
export function searchConsolePeriod(now: Date) {
  const end = now.getTime() - dataLagDays * dayMilliseconds;
  return { startDate: vietnamDate(end - (periodDays - 1) * dayMilliseconds), endDate: vietnamDate(end) };
}

/** Cụm có nhiều lượt hiện mà hạng 8–20 (gần trang đầu) hoặc đã ở trang đầu nhưng ít người bấm: sửa tiêu đề/mô tả/nội dung thường có lời nhất. */
export function buildOpportunities(queries: readonly SearchConsoleQuery[]): SearchConsoleOpportunity[] {
  const nearPageOne = queries.filter((item) => item.position >= 8 && item.position <= 20 && item.impressions >= minImpressionsNearPageOne)
    .map((item): SearchConsoleOpportunity => ({ ...item, reason: "near_page_one" }));
  const lowClicks = queries.filter((item) => item.position < 8 && item.impressions >= minImpressionsLowCtr && item.ctr < lowCtr)
    .map((item): SearchConsoleOpportunity => ({ ...item, reason: "low_ctr" }));
  return [...nearPageOne, ...lowClicks].sort((a, b) => b.impressions - a.impressions).slice(0, maxOpportunities);
}

/** Chọn thuộc tính Search Console khớp tên miền website: ưu tiên "Tên miền" (sc-domain), rồi https://tên-miền/, rồi www, rồi http. */
export function pickProperty(entries: ReadonlyArray<{ siteUrl: string; permissionLevel?: string }>, siteUrl: string | null | undefined) {
  if (!siteUrl) return undefined;
  let host: string;
  try { host = new URL(siteUrl).hostname.toLowerCase(); } catch { return undefined; }
  const apex = host.replace(/^www\./, "");
  const candidates = [`sc-domain:${apex}`, `https://${host}/`, `https://${apex}/`, `https://www.${apex}/`, `http://${host}/`, `http://${apex}/`];
  const usable = new Set(entries.filter((entry) => entry.permissionLevel !== "siteUnverifiedUser").map((entry) => entry.siteUrl.toLowerCase()));
  return candidates.find((candidate) => usable.has(candidate.toLowerCase()));
}

function toQueries(response: { rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> }): SearchConsoleQuery[] {
  return (response.rows ?? []).filter((row) => row.keys[0]).map((row) => ({ query: row.keys[0], clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }));
}

class GoogleApiError extends Error {
  constructor(readonly status: number) {
    super(`Google trả HTTP ${status}.`);
    this.name = "GoogleApiError";
  }
}

/** Câu giải thích dễ hiểu cho người vận hành; không chứa khóa hay mã truy cập. */
export function explainError(error: unknown, serviceAccountEmail?: string) {
  const email = serviceAccountEmail ? ` “${serviceAccountEmail}”` : "";
  if (error instanceof GoogleApiError) {
    if (error.status === 401 || error.status === 403) return `Google chưa cho phép tài khoản${email} đọc dữ liệu. Thêm email đó vào Search Console (Cài đặt → Người dùng và quyền → Thêm người dùng) rồi thử lại; nếu đã thêm ở quyền Hạn chế mà vẫn lỗi, nâng lên quyền Đầy đủ.`;
    if (error.status === 404) return "Google không tìm thấy thuộc tính Search Console này. Kiểm tra tên miền đã được thêm và xác minh.";
    if (error.status === 429) return "Google đang giới hạn số lần gọi tạm thời. Thử lại sau ít phút.";
    return `Google báo lỗi (HTTP ${error.status}). Thử lại sau.`;
  }
  if (error instanceof GoogleAuthError) return error.message;
  if (error instanceof Error && error.name === "SearchConsoleSetupError") return error.message;
  return "Không lấy được dữ liệu từ Google Search Console. Thử lại sau.";
}

class SearchConsoleSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchConsoleSetupError";
  }
}

type Entry<T> = { value: T; at: number };

type SessionInfo = { key: ServiceAccountKey; token: () => Promise<string>; source: "file" | "json" | "cms" };

export function createSearchConsoleService({ fetch: fetcher, env, now, readFile, siteUrl, cmsSecret }: SearchConsoleDependencies) {
  let session: Promise<SessionInfo | undefined> | undefined;
  const cache = new Map<string, Entry<unknown>>();
  // Chữ ký của phần cấu hình đang lấy từ CMS: đổi khóa/thuộc tính ở CMS thì xóa số liệu đã nhớ để lần sau dùng khóa mới ngay.
  let cmsSignature: string | undefined;
  let cmsSession: { raw: string; info: SessionInfo } | undefined;

  const envKeyConfigured = () => Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim());
  const propertyOverride = async () => env.SEARCH_CONSOLE_PROPERTY?.trim() || (await cmsSecret?.("search_console_property")) || undefined;

  async function syncCmsSource() {
    if (!cmsSecret) return;
    const signature = envKeyConfigured() ? "env" : `${(await cmsSecret("google_service_account")) ?? ""}|${(await cmsSecret("search_console_property")) ?? ""}`;
    if (cmsSignature !== undefined && cmsSignature !== signature) cache.clear();
    cmsSignature = signature;
  }

  function buildSession(raw: string, source: SessionInfo["source"]): SessionInfo {
    let key: ServiceAccountKey;
    try { key = parseServiceAccountKey(raw); } catch (error) { throw new SearchConsoleSetupError(error instanceof Error ? error.message : "Khóa tài khoản dịch vụ không hợp lệ."); }
    return { key, token: createTokenProvider({ fetch: fetcher, now, key }), source };
  }

  async function loadCmsSession(): Promise<SessionInfo | undefined> {
    const raw = await cmsSecret?.("google_service_account");
    if (!raw) { cmsSession = undefined; return undefined; }
    if (cmsSession?.raw !== raw) cmsSession = { raw, info: buildSession(raw, "cms") };
    return cmsSession.info;
  }

  function loadSession() {
    // Biến môi trường luôn thắng; chưa đặt thì dùng khóa nhập ở CMS (xét lại mỗi lần vì Super Admin có thể vừa đổi khóa).
    if (!envKeyConfigured()) return loadCmsSession();
    session ??= (async () => {
      const inline = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
      const file = env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim();
      let raw = inline;
      if (!raw) {
        try { raw = await readFile(file!); } catch { throw new SearchConsoleSetupError("Không đọc được tệp khóa tại GOOGLE_SERVICE_ACCOUNT_FILE. Kiểm tra đường dẫn và quyền đọc tệp."); }
      }
      return buildSession(raw, inline ? "json" : "file");
    })();
    // Cấu hình hỏng thì lần sau đọc lại (người vận hành có thể vừa sửa tệp).
    session.catch(() => { session = undefined; });
    return session;
  }

  async function call<T>(token: string, path: string, init?: { body: unknown }): Promise<T> {
    let response: Response;
    try {
      response = await fetcher(`${apiBase}${path}`, {
        method: init ? "POST" : "GET",
        headers: { authorization: `Bearer ${token}`, accept: "application/json", ...(init ? { "content-type": "application/json" } : {}) },
        ...(init ? { body: JSON.stringify(init.body) } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      });
    } catch {
      throw new Error("Không kết nối được Google Search Console.");
    }
    if (!response.ok) throw new GoogleApiError(response.status);
    return await response.json() as T;
  }

  async function resolveProperty(token: string, email: string) {
    const override = await propertyOverride();
    if (override) return override;
    const site = await siteUrl();
    const entries = siteListResponseSchema.parse(await call(token, "/sites")).siteEntry ?? [];
    const property = pickProperty(entries, site);
    if (property) return property;
    const host = site ? new URL(site).hostname : "";
    throw new SearchConsoleSetupError(entries.length
      ? `Tài khoản “${email}” thấy ${entries.length} website trong Search Console nhưng không có website nào khớp “${host || "địa chỉ website"}”. Kiểm tra địa chỉ website trong Cài đặt “Tên miền & SEO”, hoặc đặt SEARCH_CONSOLE_PROPERTY.`
      : `Tài khoản “${email}” chưa thấy website nào trong Search Console. Thêm email đó vào website ở Search Console (Cài đặt → Người dùng và quyền → Thêm người dùng).`);
  }

  const searchAnalytics = async (token: string, property: string, body: Record<string, unknown>) =>
    searchAnalyticsResponseSchema.parse(await call(token, `/sites/${encodeURIComponent(property)}/searchAnalytics/query`, { body }));

  function fresh<T>(key: string, ttl: number) {
    const entry = cache.get(key) as Entry<T> | undefined;
    return entry && now().getTime() - entry.at < ttl ? entry.value : undefined;
  }
  const remember = (key: string, value: unknown) => cache.set(key, { value, at: now().getTime() });

  /** Có kết quả thành công cũ (hết hạn) thì dùng tạm khi Google lỗi, thay vì báo lỗi ngay. */
  function staleFallback<T>(key: string) {
    return (cache.get(key) as Entry<T> | undefined)?.value;
  }

  async function failure(error: unknown, context: string, key: string) {
    const email = await loadSession().then((current) => current?.key.clientEmail, () => undefined);
    const message = explainError(error, email);
    logger.warn(`Search Console: ${context}`, { message });
    remember(`${key}:error`, { connection: "error", message });
    return { connection: "error" as const, message };
  }

  async function getOverview(): Promise<SearchConsoleOverview> {
    await syncCmsSource();
    const cached = fresh<SearchConsoleOverview>("overview", cacheTtlMilliseconds) ?? fresh<SearchConsoleOverview>("overview:error", errorTtlMilliseconds);
    if (cached) return cached;
    try {
      const current = await loadSession();
      if (!current) return { connection: "not_configured" };
      const token = await current.token();
      const property = await resolveProperty(token, current.key.clientEmail);
      const period = searchConsolePeriod(now());
      const [totalsResponse, queriesResponse] = await Promise.all([
        searchAnalytics(token, property, period),
        searchAnalytics(token, property, { ...period, dimensions: ["query"], rowLimit: 250 }),
      ]);
      const total = totalsResponse.rows?.[0];
      const totals: SearchConsoleTotals = { clicks: total?.clicks ?? 0, impressions: total?.impressions ?? 0, ctr: total?.ctr ?? 0, position: total?.position ?? 0 };
      const queries = toQueries(queriesResponse);
      const result: SearchConsoleOverview = {
        connection: "connected", property, period, totals,
        topQueries: [...queries].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 10),
        opportunities: buildOpportunities(queries),
      };
      remember("overview", result);
      return result;
    } catch (error) {
      const stale = staleFallback<SearchConsoleOverview>("overview");
      if (stale) { logger.warn("Search Console: lỗi khi làm mới, dùng số liệu cũ.", { message: explainError(error) }); return stale; }
      return failure(error, "không lấy được tổng quan.", "overview");
    }
  }

  /** Những cụm khách gõ để thấy một trang cụ thể (tối đa 10, nhiều lượt hiện nhất). `path` là đường dẫn công khai, ví dụ /news/ten-bai. */
  async function getPageQueries(path: string): Promise<SearchConsolePageQueries> {
    await syncCmsSource();
    const key = `page:${path}`;
    const cached = fresh<SearchConsolePageQueries>(key, cacheTtlMilliseconds) ?? fresh<SearchConsolePageQueries>(`${key}:error`, errorTtlMilliseconds);
    if (cached) return cached;
    try {
      const current = await loadSession();
      if (!current) return { connection: "not_configured" };
      const site = await siteUrl();
      if (!site) throw new SearchConsoleSetupError("Chưa đặt địa chỉ website trong Cài đặt “Tên miền & SEO” nên chưa hỏi Google về từng trang được.");
      const token = await current.token();
      const property = await resolveProperty(token, current.key.clientEmail);
      const period = searchConsolePeriod(now());
      const response = await searchAnalytics(token, property, {
        ...period, dimensions: ["query"], rowLimit: 10,
        dimensionFilterGroups: [{ groupType: "and", filters: [{ dimension: "page", operator: "equals", expression: `${new URL(site).origin}${path}` }] }],
      });
      const result: SearchConsolePageQueries = { connection: "connected", period, queries: toQueries(response).sort((a, b) => b.impressions - a.impressions) };
      remember(key, result);
      return result;
    } catch (error) {
      const stale = staleFallback<SearchConsolePageQueries>(key);
      if (stale) return stale;
      return failure(error, `không lấy được cụm tìm kiếm của ${path}.`, key);
    }
  }

  const keySource = (current?: SessionInfo): "file" | "json" | "cms" => current?.source ?? (env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ? "json" : env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim() ? "file" : "cms");
  const propertyFromSetting = async () => Boolean(await propertyOverride());

  /** Cho màn Cài đặt Google Search Console và lệnh `pnpm gsc:check`: cấu hình đã đủ chưa, tài khoản thấy những website nào, thuộc tính nào được chọn. Không đọc từ bộ nhớ đệm. */
  async function runDiagnosis(): Promise<SearchConsoleDiagnosis> {
    try {
      const current = await loadSession();
      if (!current) return { configured: false };
      const email = current.key.clientEmail;
      const site = await siteUrl().catch(() => null);
      try {
        const token = await current.token();
        const entries = siteListResponseSchema.parse(await call(token, "/sites")).siteEntry ?? [];
        const property = (await propertyOverride()) || pickProperty(entries, site);
        if (!property) return { configured: true, source: keySource(current), propertyFromSetting: await propertyFromSetting(), email, sites: entries, websiteUrl: site ?? null, problem: explainError(new SearchConsoleSetupError(entries.length ? `Tài khoản “${email}” thấy ${entries.length} website nhưng không có website nào khớp địa chỉ ${site ?? "(chưa đặt)"}.` : `Tài khoản “${email}” chưa thấy website nào trong Search Console. Thêm email đó vào website ở Search Console (Cài đặt → Người dùng và quyền → Thêm người dùng).`), email) };
        const period = searchConsolePeriod(now());
        const rows = toQueries(await searchAnalytics(token, property, { ...period, dimensions: ["query"], rowLimit: 5 }));
        return { configured: true, source: keySource(current), propertyFromSetting: await propertyFromSetting(), email, sites: entries, websiteUrl: site ?? null, property, period, sampleQueries: rows.length };
      } catch (error) {
        return { configured: true, source: keySource(current), propertyFromSetting: await propertyFromSetting(), email, sites: [], websiteUrl: site ?? null, problem: explainError(error, email) };
      }
    } catch (error) {
      return { configured: true, source: keySource(), propertyFromSetting: await propertyFromSetting(), email: undefined, sites: [], websiteUrl: await siteUrl().catch(() => null) ?? null, problem: explainError(error) };
    }
  }

  // Nhiều người bấm "Kiểm tra kết nối" cùng lúc chỉ gọi Google một lần.
  let pendingDiagnosis: Promise<SearchConsoleDiagnosis> | undefined;
  function diagnose() {
    pendingDiagnosis ??= runDiagnosis().finally(() => { pendingDiagnosis = undefined; });
    return pendingDiagnosis;
  }

  return { getOverview, getPageQueries, diagnose };
}
