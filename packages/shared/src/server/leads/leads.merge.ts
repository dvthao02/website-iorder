import { leadInternalNoteMaxLength, type LeadStatus } from "./leads.contract";

// Gộp các liên hệ cùng số điện thoại: giữ liên hệ mới nhất, nội dung các liên hệ cũ hơn được ghi lại trong ghi chú nội bộ của nó
// (rồi các liên hệ cũ bị xóa, kể cả thông tin cá nhân trong đó), để nhân viên không mất lời nhắn, thiết bị đã hỏi hay kết quả xử lý trước đó. Hàm thuần, kiểm thử được.

/** Phần của một liên hệ cũ được ghi lại trong ghi chú. `deviceName` là thiết bị khách đã hỏi mua (nếu có). */
export type MergedLeadSource = { createdAt: Date; status: LeadStatus; need: string | null; message: string | null; deviceName: string | null };

const statusLabels: Record<LeadStatus, string> = { new: "Mới", contacted: "Đã liên hệ", closed: "Đã xử lý" };
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const lineLimit = 220;

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
const clip = (text: string, max: number) => text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

function sourceLine(source: MergedLeadSource) {
  const what = source.deviceName ? `hỏi mua ${collapse(source.deviceName)}` : source.need ? collapse(source.need) : "liên hệ chung";
  const message = source.message ? collapse(source.message) : "";
  return clip(`• ${dateTime.format(source.createdAt)} · ${what}${message ? ` · “${message}”` : ""} · ${statusLabels[source.status]}`, lineLimit);
}

/**
 * Ghi chú sau khi gộp: ghi chú cũ giữ nguyên, kèm một khối liệt kê các liên hệ đã gộp (mới nhất trước). Vượt giới hạn độ dài ghi chú
 * thì bớt các dòng cũ nhất và ghi "… và N liên hệ cũ hơn"; ghi chú cũ không bao giờ bị cắt (không còn chỗ thì trả lại đúng ghi chú cũ).
 */
export function mergeLeadNote(existing: string | null, merged: readonly MergedLeadSource[], limit = leadInternalNoteMaxLength) {
  const base = (existing ?? "").trim();
  const sorted = [...merged].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const header = `— Gộp từ ${sorted.length} liên hệ cùng số điện thoại —`;
  const lines = sorted.map(sourceLine);
  const prefix = base ? `${base}\n\n` : "";
  for (let shown = lines.length; shown >= 0; shown -= 1) {
    const rest = lines.length - shown;
    const text = `${prefix}${[header, ...lines.slice(0, shown), ...(rest > 0 ? [`• … và ${rest} liên hệ cũ hơn`] : [])].join("\n")}`;
    if (text.length <= limit) return text;
  }
  return base;
}

const progress: Record<LeadStatus, number> = { new: 0, contacted: 1, closed: 2 };

/**
 * Trạng thái của liên hệ được giữ lại sau khi gộp: lấy mức xử lý thấp nhất trong cả nhóm (Mới < Đã liên hệ < Đã xử lý), để một liên hệ cũ
 * chưa ai xử lý không biến mất chỉ vì liên hệ mới hơn đã đóng.
 */
export function mergedLeadStatus(statuses: readonly LeadStatus[]): LeadStatus {
  return statuses.reduce<LeadStatus>((lowest, status) => progress[status] < progress[lowest] ? status : lowest, "closed");
}
