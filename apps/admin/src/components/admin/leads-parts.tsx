"use client";

import { Check, CheckCircle2, Copy, Inbox, MessageCircle, PhoneCall } from "lucide-react";
import { useState, type FormEvent, type MouseEvent, type ReactNode } from "react";

import { leadOverdueHours } from "@iorder/shared/server/dashboard/notifications.contract";
import type { EquipmentAvailability } from "@iorder/shared/server/equipment/equipment-availability";
import { leadInternalNoteMaxLength, type LeadAssignee, type LeadContext, type LeadListQuery } from "@iorder/shared/server/leads/leads.contract";
import { formatPhoneDisplay, isValidPhone, normalizePhone, phoneRule } from "@iorder/shared/server/leads/leads.phone";
import { formatTimeAgo, formatWaitingTime } from "@iorder/shared/server/shared/relative-time";
import { useNowMinute } from "@/lib/use-now";

import { AdminButton } from "./ui/admin-button";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";

// Phần dùng chung của màn Khách hàng tiềm năng: kiểu dữ liệu, nhãn, và các mảnh giao diện nhỏ (chờ bao lâu, ghi chú, sửa thông tin khách).
// Bảng và hành động nằm ở leads-manager.tsx; khung chi tiết ở lead-detail-panel.tsx.

export type LeadStatus = "new" | "contacted" | "closed";
export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  businessModel: string | null;
  branches: string | null;
  need: string | null;
  message: string | null;
  status: LeadStatus;
  createdAt: Date;
  handledAt: Date | null;
  /** Thiết bị khách hỏi mua, chụp lúc gửi (tên, giá, tình trạng hàng khi đó); null = liên hệ chung. */
  context: LeadContext | null;
  /** Ghi chú nội bộ của nhân viên (khách không thấy) và tên người đã xử lý. */
  internalNote: string | null;
  handledByName: string | null;
  /** Số liên hệ cùng số điện thoại, kể cả liên hệ này (>= 2: khách gửi lại). */
  sameCustomerCount: number;
  /** Người phụ trách (null = chưa giao) và thời điểm giao. */
  assignedToId: string | null;
  assignedToName: string | null;
  assignedAt: Date | null;
};
export type LeadSource = LeadListQuery["source"];
export type LeadFocus = LeadListQuery["focus"];
/** Phần sửa gửi lên Backend; số điện thoại và email do Backend chuẩn hóa (email rỗng là xóa). */
export type LeadPatch = { status?: LeadStatus; internalNote?: string; assignedTo?: string | null; name?: string; phone?: string; email?: string | null };

export const statusLabel: Record<LeadStatus, string> = { new: "Mới", contacted: "Đã liên hệ", closed: "Đã xử lý" };
export const statusTone = { new: "warning", contacted: "info", closed: "success" } as const;
export const statuses: LeadStatus[] = ["new", "contacted", "closed"];
export const statusIcons: Record<LeadStatus, ReactNode> = { new: <Inbox aria-hidden="true" />, contacted: <PhoneCall aria-hidden="true" />, closed: <CheckCircle2 aria-hidden="true" /> };
export const focusLabels: Record<LeadFocus, string> = { all: "Tất cả liên hệ", overdue: `Chờ quá ${leadOverdueHours} giờ`, repeat: "Khách gửi nhiều lần" };
export const sourceLabels: Record<LeadSource, string> = { all: "Mọi nguồn", equipment: "Hỏi mua thiết bị", general: "Liên hệ chung" };
export const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
export const priceFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
export const availabilityTone: Record<EquipmentAvailability, "success" | "warning" | "info" | "error" | "neutral"> = { in_stock: "success", limited: "warning", pre_order: "info", out_of_stock: "error", discontinued: "neutral" };
const overdueMs = leadOverdueHours * 60 * 60 * 1000;

/** Số điện thoại hiển thị chuẩn hóa, kèm liên kết gọi và Zalo (chỉ với số hợp lệ). Số cũ sai quy tắc giữ nguyên như khách đã nhập. */
export function phoneLinks(raw: string) {
  const phone = formatPhoneDisplay(raw);
  return { ...phone, tel: `tel:${phone.valid ? phone.digits : raw.replace(/[^\d+]/g, "")}`, zalo: phone.valid ? `https://zalo.me/${phone.digits}` : null };
}

/**
 * Gọi, nhắn Zalo và sao chép số điện thoại. `labeled` (khung chi tiết): nút có chữ; mặc định (bảng): nút biểu tượng nhỏ luôn hiện, bấm không mở khung chi tiết.
 * Sao chép xong nút đổi thành dấu tick một lúc để biết đã chép. Số cũ sai quy tắc không có nút Zalo (không biết số thật).
 */
export function LeadPhoneActions({ raw, labeled = false }: { raw: string; labeled?: boolean }) {
  const { show } = useAdminToast();
  const phone = phoneLinks(raw);
  const [copied, setCopied] = useState(false);
  async function copy(event: MouseEvent) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(phone.digits);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    } catch {
      show("Không sao chép được. Hãy chọn số và sao chép thủ công.", "error");
    }
  }
  if (labeled) {
    return <span className="inline-flex flex-wrap gap-2">
      <AdminButton href={phone.tel} leadingIcon={<PhoneCall aria-hidden="true" size={14} />} size="sm" variant="secondary">Gọi</AdminButton>
      {phone.zalo ? <AdminButton href={phone.zalo} leadingIcon={<MessageCircle aria-hidden="true" size={14} />} rel="noopener noreferrer" size="sm" target="_blank" variant="secondary">Zalo</AdminButton> : null}
      <AdminButton leadingIcon={copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />} onClick={(event) => void copy(event)} size="sm" type="button" variant="secondary">{copied ? "Đã sao chép" : "Sao chép"}</AdminButton>
    </span>;
  }
  return <span className="lead-quick-actions">
    <a aria-label={`Gọi ${phone.text}`} href={phone.tel} onClick={(event) => event.stopPropagation()} title="Gọi"><PhoneCall aria-hidden="true" size={15} /></a>
    {phone.zalo ? <a aria-label={`Nhắn Zalo ${phone.text}`} href={phone.zalo} onClick={(event) => event.stopPropagation()} rel="noopener noreferrer" target="_blank" title="Nhắn Zalo"><MessageCircle aria-hidden="true" size={15} /></a> : null}
    <button aria-label={`Sao chép số ${phone.text}`} data-done={copied ? "" : undefined} onClick={(event) => void copy(event)} title={copied ? "Đã sao chép" : "Sao chép số"} type="button">{copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}</button>
  </span>;
}

/** Liên hệ "Mới" đã chờ quá ngưỡng: nhắc đã chờ bao lâu. Không hiện khi chưa có giờ trình duyệt (lúc dựng trên máy chủ). */
export function LeadWaiting({ lead }: { lead: Lead }) {
  const now = useNowMinute();
  const created = new Date(lead.createdAt);
  if (!now || lead.status !== "new" || now - created.getTime() < overdueMs) return null;
  return <AdminStatusBadge tone="error">Chờ {formatWaitingTime(created, new Date(now))}</AdminStatusBadge>;
}

/** Giờ gửi chính xác, kèm "5 phút trước" hoặc, nếu liên hệ mới bị bỏ quên, mức chờ. */
export function LeadAge({ lead }: { lead: Lead }) {
  const now = useNowMinute();
  const created = new Date(lead.createdAt);
  const waiting = lead.status === "new" && now > 0 && now - created.getTime() >= overdueMs;
  return <span className="grid justify-items-start gap-0.5">
    <span className="admin-text-muted">{dateTimeFormatter.format(created)}</span>
    {waiting ? <LeadWaiting lead={lead} /> : now ? <span className="admin-text-muted text-xs">{formatTimeAgo(created, new Date(now))}</span> : null}
  </span>;
}

/** Ghi chú nội bộ: soạn nháp tại chỗ, chỉ lưu khi bấm Lưu. Cha đặt `key` theo ghi chú đã lưu nên sau khi lưu xong ô tự khớp bản mới. */
export function LeadNoteEditor({ lead, canUpdate, saving, onSave }: { lead: Lead; canUpdate: boolean; saving: boolean; onSave: (note: string) => void }) {
  const saved = lead.internalNote ?? "";
  const [draft, setDraft] = useState(saved);
  const dirty = draft.trim() !== saved;
  return <div className="grid gap-2">
    <textarea aria-label="Ghi chú nội bộ" className="admin-input" disabled={!canUpdate} maxLength={leadInternalNoteMaxLength} onChange={(event) => setDraft(event.target.value)} placeholder="Kết quả cuộc gọi, hẹn gọi lại, báo giá đã gửi…" rows={4} value={draft} />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <small className="admin-text-muted">Chỉ nhân viên CMS thấy · {draft.length}/{leadInternalNoteMaxLength}</small>
      <AdminButton disabled={!canUpdate || !dirty || saving} onClick={() => onSave(draft)} size="sm" type="button" variant="secondary">{saving ? "Đang lưu…" : "Lưu ghi chú"}</AdminButton>
    </div>
  </div>;
}

/** Ô chọn trạng thái của liên hệ (dùng trong bảng và khung chi tiết). */
export function LeadStatusSelect({ lead, label, disabled, onChange }: { lead: Lead; label: string; disabled: boolean; onChange: (status: LeadStatus) => void }) {
  return <select aria-label={label} className="admin-select--compact" disabled={disabled} onChange={(event) => onChange(event.target.value as LeadStatus)} value={lead.status}>
    {statuses.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
  </select>;
}

/**
 * Ô chọn người phụ trách. Người đã nghỉ hoặc mất quyền xem vẫn hiện tên (để thấy ai đang giữ liên hệ) cho tới khi giao lại.
 * `userId` là tài khoản đang xem: tên của họ ghi thêm "(tôi)".
 */
export function LeadAssigneeSelect({ lead, label, disabled, assignees, userId, onChange }: { lead: Lead; label: string; disabled: boolean; assignees: LeadAssignee[]; userId: string | null; onChange: (assignedTo: string | null) => void }) {
  return <select aria-label={label} className="admin-select--compact" disabled={disabled} onChange={(event) => onChange(event.target.value || null)} value={lead.assignedToId ?? ""}>
    <option value="">Chưa giao</option>
    {lead.assignedToId && !assignees.some((person) => person.id === lead.assignedToId) ? <option value={lead.assignedToId}>{lead.assignedToName ?? "Tài khoản đã xóa"}</option> : null}
    {assignees.map((person) => <option key={person.id} value={person.id}>{person.id === userId ? `${person.name} (tôi)` : person.name}</option>)}
  </select>;
}

const errorStyle = { color: "var(--cms-danger, #dc2626)" } as const;

/**
 * Sửa thông tin khách (họ tên, số điện thoại, email), ví dụ khách gõ nhầm số hoặc liên hệ cũ có số chưa chuẩn. Số điện thoại theo quy tắc chung
 * (10–11 chữ số, +84 thay số 0 đầu) và được lưu dạng chữ số. `onSave` trả về true khi lưu được (cha dùng để đóng biểu mẫu).
 */
export function LeadContactEditor({ lead, saving, onSave, onCancel }: { lead: Lead; saving: boolean; onSave: (patch: LeadPatch) => Promise<boolean>; onCancel: () => void }) {
  const current = phoneLinks(lead.phone);
  const initialPhone = current.valid ? current.digits : lead.phone;
  const [name, setName] = useState(lead.name);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(lead.email ?? "");
  const nameOk = name.trim().length >= 2;
  const phoneOk = isValidPhone(phone);
  const emailOk = !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim());
  const dirty = name.trim() !== lead.name || phone.trim() !== initialPhone || email.trim() !== (lead.email ?? "");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!dirty || !nameOk || !phoneOk || !emailOk || saving) return;
    const patch: LeadPatch = {};
    if (name.trim() !== lead.name) patch.name = name.trim();
    if (phone.trim() !== initialPhone) patch.phone = normalizePhone(phone);
    if (email.trim() !== (lead.email ?? "")) patch.email = email.trim();
    if (await onSave(patch)) onCancel();
  }
  return <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
    <label className="grid gap-1 text-sm font-semibold">Họ tên<input autoComplete="off" className="admin-input" maxLength={180} onChange={(event) => setName(event.target.value)} value={name} />
      {nameOk ? null : <small style={errorStyle}>Họ tên cần ít nhất 2 ký tự.</small>}</label>
    <label className="grid gap-1 text-sm font-semibold">Số điện thoại<input autoComplete="off" className="admin-input" inputMode="tel" maxLength={20} onChange={(event) => setPhone(event.target.value)} value={phone} />
      {phoneOk ? null : <small style={errorStyle}>{phoneRule}</small>}</label>
    <label className="grid gap-1 text-sm font-semibold">Email<input autoComplete="off" className="admin-input" maxLength={320} onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
      {emailOk ? null : <small style={errorStyle}>Email chưa đúng dạng.</small>}</label>
    <div className="flex flex-wrap items-center justify-end gap-2">
      <AdminButton onClick={onCancel} size="sm" type="button" variant="ghost">Hủy</AdminButton>
      <AdminButton disabled={!dirty || !nameOk || !phoneOk || !emailOk || saving} size="sm" type="submit" variant="primary">{saving ? "Đang lưu…" : "Lưu thông tin"}</AdminButton>
    </div>
  </form>;
}
