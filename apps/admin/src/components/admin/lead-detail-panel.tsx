"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, Mail, Pencil, Phone, PhoneCall, RotateCcw, Trash2, UserCheck } from "lucide-react";
import { useState, type ReactNode } from "react";

import { equipmentAvailabilityLabels } from "@iorder/shared/server/equipment/equipment-availability";
import type { LeadAssignee } from "@iorder/shared/server/leads/leads.contract";

import { availabilityTone, dateTimeFormatter, LeadAssigneeSelect, LeadContactEditor, LeadNoteEditor, LeadPhoneActions, LeadStatusSelect, LeadWaiting, phoneLinks, priceFormatter, statusLabel, statusTone, type Lead, type LeadPatch, type LeadStatus } from "./leads-parts";
import { AdminButton } from "./ui/admin-button";
import { AdminStatusBadge } from "./ui/admin-feedback";

type LeadDetailPanelProps = {
  lead: Lead;
  /** Nhân viên có thể được giao, tài khoản đang xem và tên của họ trong danh sách đó (null nếu không có quyền được giao). */
  assignees: LeadAssignee[];
  userId: string | null;
  myName: string | null;
  canUpdate: boolean;
  /** Liên hệ này đang có yêu cầu cập nhật chạy dở. */
  busy: boolean;
  /** Gửi phần sửa; trả về true khi lưu được. */
  onUpdate: (patch: LeadPatch) => Promise<boolean>;
  onShowSamePhone: () => void;
};

const deniedUpdate = "Cần quyền cập nhật liên hệ.";

// Khung chi tiết một liên hệ: thông tin khách (sửa được), thiết bị hỏi mua, trạng thái, người phụ trách, ghi chú nội bộ, xóa.
// Cha đặt `key` theo mã liên hệ nên mở liên hệ khác thì biểu mẫu sửa tự đóng.
export function LeadDetailPanel({ lead, assignees, userId, myName, canUpdate, busy, onUpdate, onShowSamePhone }: LeadDetailPanelProps) {
  const [editing, setEditing] = useState(false);
  const phone = phoneLinks(lead.phone);
  return <>
    <header className="admin-list-manager__panel-header">
      <p>Khách hàng tiềm năng</p>
      <h2>{lead.name}</h2>
      <small className="inline-flex flex-wrap items-center gap-2"><AdminStatusBadge tone={statusTone[lead.status]}>{statusLabel[lead.status]}</AdminStatusBadge><LeadWaiting lead={lead} /></small>
    </header>
    <div className="admin-list-manager__form">
      {editing ? <div className="mb-4 border-b border-[var(--cms-border)] pb-4"><LeadContactEditor lead={lead} onCancel={() => setEditing(false)} onSave={onUpdate} saving={busy} /></div> : null}
      <dl className="admin-description-list grid-cols-1">
        <div><dt>Điện thoại</dt><dd className="grid gap-2">
          <span className="inline-flex flex-wrap items-center gap-2"><a className="inline-flex items-center gap-1.5" href={phone.tel}><Phone aria-hidden="true" size={15} />{phone.text}</a>{phone.valid ? null : <AdminStatusBadge tone="warning">Số chưa chuẩn</AdminStatusBadge>}</span>
          <span className="inline-flex flex-wrap items-center gap-2">
            <LeadPhoneActions labeled raw={lead.phone} />
            {canUpdate && !editing ? <AdminButton leadingIcon={<Pencil aria-hidden="true" size={14} />} onClick={() => setEditing(true)} size="sm" type="button" variant="ghost">Sửa thông tin</AdminButton> : null}
          </span>
        </dd></div>
        {lead.sameCustomerCount > 1 ? <div><dt>Khách gửi lại</dt><dd className="font-normal">Số này đã gửi {lead.sameCustomerCount} liên hệ. <button className="admin-link" onClick={onShowSamePhone} type="button">Xem tất cả</button> để chọn và gộp liên hệ trùng.</dd></div> : null}
        <div><dt>Email</dt><dd>{lead.email ? <a className="inline-flex items-center gap-1.5" href={`mailto:${lead.email}`}><Mail aria-hidden="true" size={15} />{lead.email}</a> : "—"}</dd></div>
        <div><dt>Mô hình kinh doanh</dt><dd>{lead.businessModel ?? "—"}</dd></div>
        <div><dt>Số chi nhánh</dt><dd>{lead.branches ?? "—"}</dd></div>
        <div><dt>Nhu cầu</dt><dd>{lead.need ?? "—"}</dd></div>
        {lead.context ? <div><dt>Thiết bị hỏi mua</dt><dd className="grid gap-1 font-normal">
          <a className="admin-link font-semibold" href={`/admin/equipment/${lead.context.equipmentId}`}>{lead.context.name}</a>
          <span>{[lead.context.modelCode ? `Mã / quy cách: ${lead.context.modelCode}` : null, lead.context.brand, lead.context.groupName].filter(Boolean).join(" · ") || "—"}</span>
          <span><AdminStatusBadge tone={availabilityTone[lead.context.availability]}>{equipmentAvailabilityLabels[lead.context.availability]}</AdminStatusBadge> · {priceFormatter.format(lead.context.priceVnd)} <span className="admin-text-muted">(lúc {dateTimeFormatter.format(new Date(lead.context.capturedAt))}, có thể khác hiện tại)</span></span>
        </dd></div> : null}
        <div><dt>Lời nhắn</dt><dd className="whitespace-pre-wrap font-normal">{lead.message ?? "—"}</dd></div>
        <div><dt>Gửi lúc</dt><dd>{dateTimeFormatter.format(new Date(lead.createdAt))}</dd></div>
        {lead.handledAt ? <div><dt>Xử lý lúc</dt><dd>{dateTimeFormatter.format(new Date(lead.handledAt))}{lead.handledByName ? <span className="admin-text-muted"> · {lead.handledByName}</span> : null}</dd></div> : null}
        <div><dt>Trạng thái</dt><dd><LeadStatusSelect disabled={busy || !canUpdate} label="Trạng thái liên hệ" lead={lead} onChange={(status) => void onUpdate({ status })} /></dd></div>
        <div><dt>Người phụ trách</dt><dd className="grid gap-2 font-normal">
          <LeadAssigneeSelect assignees={assignees} disabled={busy || !canUpdate} label="Người phụ trách liên hệ" lead={lead} onChange={(assignedTo) => void onUpdate({ assignedTo })} userId={userId} />
          <span className="inline-flex flex-wrap items-center gap-2">
            {userId && myName && lead.assignedToId !== userId ? <AdminButton disabled={!canUpdate || busy} leadingIcon={<UserCheck aria-hidden="true" size={14} />} onClick={() => void onUpdate({ assignedTo: userId })} size="sm" title={canUpdate ? "Giao liên hệ này cho bạn" : deniedUpdate} type="button" variant="secondary">Nhận xử lý</AdminButton> : null}
            {lead.assignedAt ? <small className="admin-text-muted">Giao lúc {dateTimeFormatter.format(new Date(lead.assignedAt))}</small> : <small className="admin-text-muted">Chưa giao cho ai.</small>}
          </span>
        </dd></div>
        <div><dt>Ghi chú nội bộ</dt><dd className="font-normal"><LeadNoteEditor canUpdate={canUpdate} key={`${lead.id}:${lead.internalNote ?? ""}`} lead={lead} onSave={(note) => void onUpdate({ internalNote: note })} saving={busy} /></dd></div>
      </dl>
    </div>
  </>;
}

type LeadDetailFooterProps = {
  lead: Lead;
  /** Vị trí trong danh sách đang xem (null khi liên hệ mở từ thông báo và không nằm ở trang này): có thì hiện nút Trước / Sau. */
  position: { index: number; total: number } | null;
  canUpdate: boolean;
  canDelete: boolean;
  busy: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onStatus: (status: LeadStatus) => void;
  onDelete: () => void;
};

// Việc tiếp theo hợp lý nhất của từng trạng thái: Mới → vừa gọi xong, Đã liên hệ → xử lý xong, Đã xử lý → mở lại nếu cần.
const nextStatus = {
  new: { status: "contacted", label: "Đã liên hệ", icon: <PhoneCall aria-hidden="true" size={14} />, variant: "primary" },
  contacted: { status: "closed", label: "Đã xử lý", icon: <CheckCircle2 aria-hidden="true" size={14} />, variant: "primary" },
  closed: { status: "new", label: "Mở lại", icon: <RotateCcw aria-hidden="true" size={14} />, variant: "secondary" },
} as const satisfies Record<LeadStatus, { status: LeadStatus; label: string; icon: ReactNode; variant: "primary" | "secondary" }>;

/**
 * Thanh nút cố định ở chân khung chi tiết, luôn thấy dù khung cuộn dài: chuyển sang liên hệ trước/sau (phím ↑ ↓ hoặc K J), đổi trạng thái một chạm
 * và xóa liên hệ rác. Đổi trạng thái xong ở một tab lọc thì liên hệ rời danh sách và khung tự chuyển sang liên hệ kế tiếp (xem leads-manager.tsx).
 */
export function LeadDetailFooter({ lead, position, canUpdate, canDelete, busy, onPrevious, onNext, onStatus, onDelete }: LeadDetailFooterProps) {
  const next = nextStatus[lead.status];
  return <>
    {position ? <span aria-label="Chuyển liên hệ" className="mr-auto inline-flex items-center gap-1" role="group">
      <AdminButton aria-label="Liên hệ trước" disabled={position.index <= 0} leadingIcon={<ChevronLeft aria-hidden="true" size={15} />} onClick={onPrevious} size="sm" title="Liên hệ trước (↑ hoặc K)" type="button" variant="ghost">Trước</AdminButton>
      <small aria-live="polite" className="admin-text-muted">{position.index + 1}/{position.total}</small>
      <AdminButton aria-label="Liên hệ sau" disabled={position.index >= position.total - 1} leadingIcon={<ChevronRight aria-hidden="true" size={15} />} onClick={onNext} size="sm" title="Liên hệ sau (↓ hoặc J)" type="button" variant="ghost">Sau</AdminButton>
    </span> : <span className="mr-auto" />}
    {canDelete ? <AdminButton disabled={busy} leadingIcon={<Trash2 aria-hidden="true" size={14} />} onClick={onDelete} size="sm" title="Xóa liên hệ rác (xóa cả thông tin khách)" type="button" variant="danger">Xóa</AdminButton> : null}
    <AdminButton disabled={!canUpdate || busy} leadingIcon={next.icon} onClick={() => onStatus(next.status)} size="sm" title={canUpdate ? `Chuyển sang “${statusLabel[next.status]}”` : deniedUpdate} type="button" variant={next.variant}>{busy ? "Đang lưu…" : next.label}</AdminButton>
  </>;
}
