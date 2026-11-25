import { createTranslate, type Translate } from "./translate";

export type LeadSubmitResult = { ok: boolean; message: string };

// Mã phiên gửi: Backend cấp ở GET /api/v1/leads (ký HMAC, ghi giờ cấp) và chỉ nhận liên hệ có mã đã đủ tuổi (leads.guard.ts).
// Biểu mẫu gọi `warmLeadToken()` ngay khi hiện ra để lúc khách bấm Gửi mã đã đủ tuổi; mã dùng lại cho nhiều lần gửi trong cùng tab
// cho tới khi gần hết hạn (Backend cho 3 giờ).
const tokenMinAgeMs = 2_300; // Backend đòi 2 giây; cộng chút dư để lệch đồng hồ giữa hai máy không làm gửi hụt.
const tokenReuseMs = 2 * 60 * 60 * 1000;

type LeadToken = { value: string; fetchedAt: number };
let cached: LeadToken | null = null;
let loading: Promise<LeadToken | null> | null = null;

async function fetchLeadToken(): Promise<LeadToken | null> {
  try {
    const response = await fetch("/api/v1/leads", { cache: "no-store", headers: { accept: "application/json" } });
    const body = await response.json().catch(() => null) as { token?: unknown } | null;
    return response.ok && typeof body?.token === "string" ? { value: body.token, fetchedAt: Date.now() } : null;
  } catch {
    return null;
  }
}

async function ensureLeadToken(force = false): Promise<LeadToken | null> {
  if (!force && cached && Date.now() - cached.fetchedAt < tokenReuseMs) return cached;
  loading ??= fetchLeadToken().finally(() => { loading = null; });
  cached = await loading;
  return cached;
}

/** Quên mã đang giữ (dùng trong kiểm thử; trình duyệt tự làm mới khi mã gần hết hạn). */
export function resetLeadToken() {
  cached = null;
  loading = null;
}

/** Xin mã phiên trước (không chờ kết quả). Gọi khi biểu mẫu hiện ra. */
export function warmLeadToken() {
  if (typeof window === "undefined") return;
  void ensureLeadToken();
}

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

// Gửi liên hệ tới Backend (qua rewrite `/api/v1/leads`): dùng chung cho biểu mẫu trong trang, biểu mẫu tư vấn tự hiện và hỏi mua thiết bị.
// Mã phiên hết hạn hoặc bị coi là chưa đủ tuổi thì xin mã mới và gửi lại đúng một lần, khách không phải làm gì thêm.
export async function submitLead(payload: Record<string, FormDataEntryValue>, t: Translate = createTranslate()): Promise<LeadSubmitResult> {
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await ensureLeadToken(attempt > 0);
      if (token) {
        const wait = tokenMinAgeMs - (Date.now() - token.fetchedAt);
        if (wait > 0) await sleep(wait);
      }
      const response = await fetch("/api/v1/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(token ? { ...payload, token: token.value } : payload) });
      const body = await response.json().catch(() => null) as { message?: string; error?: { code?: string; message?: string } } | null;
      if (response.ok) return { ok: true, message: body?.message ?? t("submit.success") };
      const retryable = body?.error?.code === "LEAD_TOKEN_INVALID" || body?.error?.code === "LEAD_TOO_FAST";
      if (retryable && attempt === 0) { cached = null; continue; }
      return { ok: false, message: body?.error?.message ?? t("submit.failed") };
    }
    return { ok: false, message: t("submit.failed") };
  } catch {
    return { ok: false, message: t("submit.network") };
  }
}
