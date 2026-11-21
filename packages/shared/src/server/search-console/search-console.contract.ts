import { z } from "zod";

// Phản hồi của Search Console API (Search Analytics). Chỉ đọc; trường thiếu coi là 0.
const metric = z.coerce.number().catch(0);
export const searchAnalyticsResponseSchema = z.object({
  rows: z.array(z.object({ keys: z.array(z.string()).default([]), clicks: metric, impressions: metric, ctr: metric, position: metric })).optional(),
});

export const siteListResponseSchema = z.object({
  siteEntry: z.array(z.object({ siteUrl: z.string(), permissionLevel: z.string().optional() })).optional(),
});

export const tokenResponseSchema = z.object({ access_token: z.string().min(1), expires_in: z.coerce.number().int().positive().catch(3600) });

/** Một cụm từ khách đã gõ trên Google và thấy website. `ctr` là 0–1; `position` là hạng trung bình (1 = đầu trang). */
export type SearchConsoleQuery = { query: string; clicks: number; impressions: number; ctr: number; position: number };

/** Cơ hội cải thiện: gần trang đầu (hạng 8–20) hoặc đã ở trang đầu nhưng ít người bấm. */
export type SearchConsoleOpportunity = SearchConsoleQuery & { reason: "near_page_one" | "low_ctr" };

export type SearchConsoleTotals = { clicks: number; impressions: number; ctr: number; position: number };

export type SearchConsoleOverview =
  | { connection: "not_configured" }
  | { connection: "error"; message: string }
  | {
    connection: "connected";
    /** Thuộc tính Search Console đang dùng (sc-domain:… hoặc https://…/). */
    property: string;
    /** Khoảng ngày đã lấy (Google trả dữ liệu trễ vài ngày). */
    period: { startDate: string; endDate: string };
    totals: SearchConsoleTotals;
    topQueries: SearchConsoleQuery[];
    opportunities: SearchConsoleOpportunity[];
  };

export type SearchConsolePageQueries =
  | { connection: "not_configured" }
  | { connection: "error"; message: string }
  | { connection: "connected"; period: { startDate: string; endDate: string }; queries: SearchConsoleQuery[] };

/**
 * Kết quả "Kiểm tra kết nối" (màn Cài đặt Google Search Console trong CMS và lệnh pnpm gsc:check). Không chứa khóa riêng hay mã truy cập;
 * `email` là địa chỉ công khai của tài khoản dịch vụ (người vận hành cần nó để thêm vào Search Console).
 */
export type SearchConsoleDiagnosis =
  | { configured: false }
  | {
    configured: true;
    /** Khóa được đặt bằng tệp (GOOGLE_SERVICE_ACCOUNT_FILE), nội dung JSON (GOOGLE_SERVICE_ACCOUNT_JSON) hay do Super Admin nhập ở CMS (đã mã hóa). */
    source: "file" | "json" | "cms";
    email?: string;
    /** Địa chỉ website đã khai ở Cài đặt "Tên miền & SEO". */
    websiteUrl: string | null;
    /** Các website tài khoản dịch vụ thấy trong Search Console. */
    sites: Array<{ siteUrl: string; permissionLevel?: string }>;
    /** Thuộc tính được dùng khi nối được. */
    property?: string;
    /** Thuộc tính do SEARCH_CONSOLE_PROPERTY (hoặc thuộc tính nhập ở CMS) ép dùng, không tự chọn theo địa chỉ website. */
    propertyFromSetting: boolean;
    period?: { startDate: string; endDate: string };
    /** Số cụm tìm kiếm mẫu Google trả về khi thử (0 = nối được nhưng chưa có số liệu). */
    sampleQueries?: number;
    /** Lý do chưa nối được, viết cho người vận hành. */
    problem?: string;
  };

/** Đường dẫn trang trên website (bắt đầu bằng /, không chứa địa chỉ đầy đủ) — dùng khi hỏi Google về một trang. */
export const searchConsolePagePathSchema = z.string().min(1).max(300).regex(/^\/[A-Za-z0-9\-._~%/]*$/, "Đường dẫn trang không hợp lệ.").refine((value) => !value.includes("//") && !value.includes(".."), "Đường dẫn trang không hợp lệ.");
