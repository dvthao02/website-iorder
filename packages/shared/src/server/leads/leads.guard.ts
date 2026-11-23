import { createHmac, timingSafeEqual } from "node:crypto";

import { evaluateLeadRateLimit, type LeadRateLimitDecision } from "./leads.rate-limit";

// Các lớp chống spam của biểu mẫu liên hệ, ngoài giới hạn theo IP ở leads.rate-limit.ts. Mọi hàm ở đây thuần (không đọc DB,
// giờ và khóa truyền vào) để kiểm thử được; phần ghi DB nằm ở leads.repository.ts.
//
// 1. Mã phiên gửi (token): website xin mã khi biểu mẫu hiện ra (GET /api/v1/leads), gửi kèm khi bấm Gửi. Mã ký bằng HMAC và ghi giờ cấp,
//    nên một lần POST thẳng vào API (không qua biểu mẫu) hoặc gửi ngay sau khi mở trang đều bị chặn.
// 2. Số điện thoại: chuẩn hóa về chữ số để đếm theo từng số (đổi IP không né được) và nhận ra liên hệ trùng.
// 3. Nội dung: tên không phải đường dẫn/địa chỉ email/chuỗi số, số điện thoại không phải dãy lặp, lời nhắn không quảng cáo nhiều liên kết.

/** Mã phiên chưa đủ tuổi thì coi là gửi quá nhanh (người thật điền ít nhất vài giây; nhập tự động của trình duyệt vẫn qua được). */
export const leadTokenMinAgeMs = 2_000;
/** Mã quá hạn thì biểu mẫu phải xin mã mới (tab mở quá lâu). */
export const leadTokenMaxAgeMs = 3 * 60 * 60 * 1000;

function tokenKey(env: NodeJS.ProcessEnv = process.env) {
  // Dùng chung muối băm IP: biến này bắt buộc có ở production và chỉ Backend giữ; tiền tố tách khóa ký khỏi việc băm IP.
  return `lead-token:${env.LEAD_IP_HASH_SALT ?? "iorder-v2"}`;
}

function sign(issued: string, key: string) {
  return createHmac("sha256", key).update(issued).digest("base64url");
}

export function issueLeadToken(now: Date = new Date(), key: string = tokenKey()) {
  const issued = String(now.getTime());
  return `${issued}.${sign(issued, key)}`;
}

export type LeadTokenCheck =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" }
  | { ok: false; reason: "too_fast"; retryAfterSeconds: number };

export function checkLeadToken(token: string | undefined, now: Date = new Date(), key: string = tokenKey()): LeadTokenCheck {
  const [issued, signature, ...rest] = (token ?? "").split(".");
  if (!issued || !signature || rest.length || !/^\d{10,16}$/.test(issued)) return { ok: false, reason: "invalid" };
  const expected = Buffer.from(sign(issued, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "invalid" };
  const age = now.getTime() - Number(issued);
  if (age < 0) return { ok: false, reason: "invalid" };
  if (age > leadTokenMaxAgeMs) return { ok: false, reason: "expired" };
  if (age < leadTokenMinAgeMs) return { ok: false, reason: "too_fast", retryAfterSeconds: Math.max(1, Math.ceil((leadTokenMinAgeMs - age) / 1000)) };
  return { ok: true };
}

/** Chỉ giữ chữ số; số bắt đầu bằng 84 (quốc tế, kể cả +84) đổi về 0 đầu để 0912…, +84 912… và 84912… là cùng một số. */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return /^84\d{9,}$/.test(digits) ? `0${digits.slice(2)}` : digits;
}

/** Số có 9–12 chữ số và không phải dãy lặp (0000000000, 0909090909): chặn số bịa, không kiểm tra đầu số nhà mạng. */
export function isPlausiblePhone(raw: string) {
  const digits = normalizePhone(raw);
  return digits.length >= 9 && digits.length <= 12 && new Set(digits).size > 2;
}

/** Họ tên có ít nhất hai chữ cái, không chứa đường dẫn, địa chỉ email hay tên miền, và không chủ yếu là chữ số. */
export function isPlausibleName(name: string) {
  if (/https?:|www\.|@|[a-z0-9-]+\.(com|net|org|vn|info|xyz|top|ru)\b/i.test(name)) return false;
  const letters = (name.match(/\p{L}/gu) ?? []).length;
  const digits = (name.match(/\d/g) ?? []).length;
  return letters >= 2 && digits <= letters / 2;
}

export function countLinks(text: string) {
  return (text.match(/https?:\/\/|www\./gi) ?? []).length;
}

/** Lời nhắn quảng cáo thường nhét nhiều liên kết; một liên kết (ví dụ trang thiết bị khách đang xem) vẫn được. */
export const leadMaxLinks = 1;

// Giới hạn theo từng số điện thoại, bất kể IP: 5 liên hệ/30 phút và 10 liên hệ/ngày. Khách thật gửi lại vì gõ sai hay hỏi mua vài thiết bị
// liền nhau vẫn đủ chỗ; liên hệ trùng hệt không tính (chỉ lưu một dòng).
export const leadPhoneLimits = [
  { windowMs: 30 * 60 * 1000, max: 5 },
  { windowMs: 24 * 60 * 60 * 1000, max: 10 },
] as const;

/** Cho gửi tiếp hay không theo các lần gửi gần đây của cùng số; bị chặn ở cửa sổ nào thì chờ lâu nhất trong các cửa sổ đó. */
export function evaluatePhoneLimit(recent: readonly Date[], now: Date): LeadRateLimitDecision {
  let wait = 0;
  for (const { windowMs, max } of leadPhoneLimits) {
    const decision = evaluateLeadRateLimit(recent, now, windowMs, max);
    if (!decision.allowed) wait = Math.max(wait, decision.retryAfterSeconds);
  }
  return wait ? { allowed: false, retryAfterSeconds: wait } : { allowed: true };
}

/** Khóa so sánh lời nhắn: bỏ khác biệt hoa thường và khoảng trắng để "Gọi lại em" và "gọi  lại em " là một. */
export function leadMessageKey(message: string | null | undefined) {
  return (message ?? "").toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();
}

/** Mã thiết bị (equipment id) trong ngữ cảnh đã lưu. Dùng mã chứ không dùng slug vì slug đổi được còn mã thì không. */
export function equipmentIdOfContext(context: unknown) {
  return typeof context === "object" && context !== null && typeof (context as { equipmentId?: unknown }).equipmentId === "string" ? (context as { equipmentId: string }).equipmentId : null;
}

/** Khoảng cách tối thiểu giữa hai liên hệ liên tiếp của cùng một số điện thoại. */
export const leadCooldownMs = 30_000;

/** Liên hệ liên tiếp: lần gửi trước của cùng số còn chưa đủ `leadCooldownMs` thì chờ nốt phần còn lại (tối đa đúng bằng khoảng này). */
export function evaluateLeadCooldown(recent: readonly Date[], now: Date): LeadRateLimitDecision {
  const latest = recent.reduce((max, date) => Math.max(max, date.getTime()), Number.NEGATIVE_INFINITY);
  const remaining = latest + leadCooldownMs - now.getTime();
  if (!(remaining > 0)) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.min(leadCooldownMs / 1000, Math.max(1, Math.ceil(remaining / 1000))) };
}

/** Cùng một IP hỏi mua cùng một thiết bị: tối đa 2 lần mỗi giờ (cho phép vài người cùng văn phòng, chặn bot đổi số điện thoại). */
export const leadIpDeviceLimit = { windowMs: 60 * 60 * 1000, max: 2 } as const;

/** Số này đã hỏi mua đúng thiết bị này trong cửa sổ đang xét (cửa sổ do nơi gọi truy vấn). Mỗi số chỉ được hỏi một thiết bị một lần. */
export function hasSameDevice(recent: ReadonlyArray<{ context: unknown }>, equipmentId: string) {
  return recent.some((row) => equipmentIdOfContext(row.context) === equipmentId);
}

/**
 * Liên hệ chung trùng: cùng số trong 24 giờ qua, đều không gắn thiết bị và cùng lời nhắn. Bấm Gửi hai lần hay bot gửi lặp
 * không tạo thêm dòng, nhưng vẫn được báo là đã nhận để không lộ cách nhận diện. Liên hệ gắn thiết bị xử lý riêng bằng `hasSameDevice`.
 */
export function isDuplicateLead(recent: ReadonlyArray<{ message: string | null; context: unknown }>, candidate: { message: string | null; equipmentId: string | null }) {
  const key = leadMessageKey(candidate.message);
  return recent.some((row) => equipmentIdOfContext(row.context) === candidate.equipmentId && leadMessageKey(row.message) === key);
}
