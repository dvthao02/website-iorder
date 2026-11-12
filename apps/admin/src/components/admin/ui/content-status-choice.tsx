"use client";

import React from "react";

export type ContentStatus = "draft" | "review" | "scheduled" | "published" | "archived";

// Trạng thái đã lưu (nhãn trên thanh bên) và nút lưu nói rõ sẽ làm gì với nội dung.
export const contentStatusBadge: Record<ContentStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" }> = {
  draft: { label: "Bản nháp", tone: "neutral" },
  review: { label: "Chờ duyệt", tone: "warning" },
  scheduled: { label: "Đã hẹn giờ", tone: "info" },
  published: { label: "Đang hiển thị trên website", tone: "success" },
  archived: { label: "Đã lưu trữ", tone: "neutral" },
};

export function contentSubmitLabel(status: ContentStatus, savedStatus: ContentStatus | undefined, noun: string) {
  if (status === "published") return savedStatus === "published" ? `Cập nhật ${noun} đã đăng` : "Xuất bản";
  if (status === "scheduled") return "Lên lịch đăng";
  if (status === "review") return "Gửi duyệt";
  if (status === "archived") return `Lưu trữ ${noun}`;
  return "Lưu nháp";
}

export function contentSavedMessage(status: ContentStatus, previous: ContentStatus | undefined, noun: string) {
  if (status === "published") return previous === "published" ? `Đã cập nhật ${noun} trên website.` : `Đã xuất bản ${noun}.`;
  if (status === "scheduled") return `Đã lên lịch đăng ${noun}.`;
  if (status === "review") return `Đã gửi duyệt ${noun}.`;
  if (status === "archived") return `Đã lưu trữ ${noun}.`;
  return previous ? "Đã lưu bản nháp." : `Đã tạo bản nháp ${noun}.`;
}

// Lựa chọn trạng thái có mô tả ngắn để người viết hiểu ngay hệ quả. "Lưu trữ" chỉ hiện khi nội dung đang lưu trữ
// (gỡ làm từ danh sách). Người thiếu quyền xuất bản không chọn được "Đăng ngay"/"Hẹn giờ".
export function ContentStatusChoice({ value, savedStatus, canPublish, noun, onChange }: { value: ContentStatus; savedStatus: ContentStatus | undefined; canPublish: boolean; noun: string; onChange: (status: ContentStatus) => void }) {
  const choices: Array<{ status: ContentStatus; label: string; hint: string }> = [
    { status: "draft", label: "Bản nháp", hint: "Chỉ người quản trị thấy." },
    { status: "review", label: "Chờ duyệt", hint: "Gửi người có quyền xuất bản xem lại." },
    { status: "published", label: savedStatus === "published" ? "Đang hiển thị" : "Đăng ngay", hint: savedStatus === "published" ? `Giữ ${noun} trên website, cập nhật nội dung mới.` : "Hiện trên website ngay khi lưu." },
    { status: "scheduled", label: "Hẹn giờ đăng", hint: "Tự hiện trên website vào thời điểm chọn." },
    ...(value === "archived" || savedStatus === "archived" ? [{ status: "archived" as const, label: "Lưu trữ", hint: "Đã gỡ khỏi website." }] : []),
  ];
  const isLocked = (status: ContentStatus) => !canPublish && (status === "published" || status === "scheduled") && status !== savedStatus;
  const active = choices.find((choice) => choice.status === value);
  return <fieldset className="admin-status-choice"><legend>Trạng thái</legend>
    <div className="admin-status-choice__grid">{choices.map((choice) => <label className={value === choice.status ? "admin-status-choice__item admin-status-choice__item--active" : "admin-status-choice__item"} key={choice.status} title={isLocked(choice.status) ? "Cần quyền xuất bản" : choice.hint}>
      <input checked={value === choice.status} disabled={isLocked(choice.status)} name="content-status" onChange={() => onChange(choice.status)} type="radio" value={choice.status} />
      <span>{choice.label}</span>
    </label>)}</div>
    {active ? <p className="admin-help">{active.hint}</p> : null}
    {!canPublish ? <p className="admin-help">Đăng ngay và hẹn giờ cần quyền xuất bản.</p> : null}
  </fieldset>;
}

// Đưa người dùng tới đúng ô còn thiếu (cuộn tới giữa màn và đặt con trỏ vào).
export function focusEditorField(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  // Ưu tiên vùng soạn thảo, rồi tới ô nhập/nút đầu tiên trong khu vực.
  const focusable = element.matches("input, textarea, select, button") ? element : element.querySelector<HTMLElement>("[contenteditable=true]") ?? element.querySelector<HTMLElement>("input, textarea, button");
  focusable?.focus({ preventScroll: true });
}

// Gợi ý (không chặn) trước khi đăng; bấm để tới đúng chỗ.
export function PrepublishHints({ missing }: { missing: Array<{ id: string; label: string }> }) {
  return missing.length ? <div className="admin-post-editor__prepublish" role="note"><strong>Nên có trước khi đăng</strong><ul>{missing.map((item) => <li key={item.id}><button className="admin-post-editor__link" onClick={() => focusEditorField(item.id)} type="button">{item.label}</button></li>)}</ul></div> : <p className="admin-post-editor__ready">Đã đủ thông tin để đăng.</p>;
}
