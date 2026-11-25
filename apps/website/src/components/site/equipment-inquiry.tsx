"use client";

import { CircleCheck, Phone, ShieldCheck, X } from "lucide-react";
import React, { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import type { EquipmentAvailability } from "@iorder/shared/server/equipment/equipment-availability";
import type { UiMessageKey } from "@iorder/shared/server/translations/ui-messages";
// Đường dẫn tương đối (không dùng "@/"): bài kiểm thử chạy từ thư mục gốc, nơi bí danh "@/" chưa được khai báo.
import { submitLead, warmLeadToken } from "../../lib/submit-lead";
import { AvailabilityBadge } from "./availability-badge";
import { Field, controlClassName, inputClassName } from "./lead-form";
import { useT } from "./messages-provider";
import { PhoneInput } from "./phone-input";

const focusable = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled])';
const priceFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

/** Thiết bị khách đang xem. Chỉ mã (slug) được gửi lên: Backend tự tra lại tên, giá, tình trạng hàng và lưu theo thời điểm gửi. */
export type InquiryEquipment = { slug: string; name: string; modelCode: string | null; priceVnd: number; availability?: EquipmentAvailability | null };

// Nút "Liên hệ mua hàng" của thiết bị: mở ngay biểu mẫu tư vấn ở trang đang xem (không chuyển sang trang Liên hệ chung) và gắn thiết bị
// vào liên hệ. Nhân viên thấy khách hỏi mua máy nào, giá và tình trạng hàng lúc đó ngay trong CMS › Khách hàng tiềm năng.
export function EquipmentInquiry({ equipment, label, className = "button button--primary", hotline = null, field }: { equipment: InquiryEquipment; label?: string; className?: string; hotline?: string | null; field?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }, []);
  return <>
    <button className={className} data-builder-field={field} data-testid="equipment-inquiry-open" onClick={() => setOpen(true)} ref={trigger} type="button">{label ?? t("inquiry.contactButton")}</button>
    {open ? createPortal(<InquiryDialog close={close} equipment={equipment} hotline={hotline} />, document.body) : null}
  </>;
}

// Thiết bị chưa bán được ngay: nói rõ để khách biết trước, nhân viên sẽ báo thời gian có hàng hoặc gợi ý thiết bị thay thế.
const availabilityNoteKeys: Partial<Record<EquipmentAvailability, UiMessageKey>> = {
  limited: "inquiry.limited",
  pre_order: "inquiry.preOrder",
  out_of_stock: "inquiry.outOfStock",
  discontinued: "inquiry.discontinued",
};

// Xuất để kiểm thử dựng đúng các trường mà Backend chấp nhận; trong ứng dụng chỉ EquipmentInquiry dùng.
export function InquiryDialog({ equipment, hotline, close }: { equipment: InquiryEquipment; hotline: string | null; close: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const availability = equipment.availability ?? "in_stock";
  const noteKey = availabilityNoteKeys[availability];
  const note = noteKey ? t(noteKey) : null;

  // Xin mã phiên gửi ngay khi hộp mở để lúc bấm Gửi mã đã đủ tuổi (chống gửi tự động, xem leads.guard.ts).
  useEffect(() => { warmLeadToken(); }, []);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Điện thoại: tự focus ô nhập sẽ bật bàn phím ngay và che gần hết hộp; chỉ tự focus khi có chuột.
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) panel.current?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
    else panel.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(focusable)];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [close]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const result = await submitLead({
      name: String(data.name ?? ""), phone: String(data.phone ?? ""), email: String(data.email ?? ""),
      // "Nhu cầu" hiện ở danh sách CMS; tình trạng và giá đầy đủ nằm ở phần thiết bị mà Backend tự chụp theo equipmentSlug.
      need: `Mua thiết bị: ${equipment.name}`.slice(0, 200), message: String(data.message ?? ""),
      website: String(data.website ?? ""), equipmentSlug: equipment.slug,
    }, t);
    setBusy(false);
    if (result.ok) { setSuccess(true); form.reset(); } else setMessage(result.message);
  }

  return <div className="consult-popup" data-testid="equipment-inquiry" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }} role="presentation">
    <div aria-labelledby={titleId} aria-modal="true" className="consult-popup__panel" ref={panel} role="dialog" tabIndex={-1}>
      <button aria-label={t("form.closeDialog")} className="consult-popup__close" onClick={close} type="button"><X aria-hidden="true" size={20} /></button>
      <div className="consult-popup__body">
        {success ? <div aria-live="polite" className="grid justify-items-center gap-3 py-6 text-center" role="status">
          <CircleCheck aria-hidden="true" className="text-accent-green" size={44} />
          <p className="mb-0 text-h3 font-bold text-ink">{t("inquiry.receivedTitle")}</p>
          <p className="mb-0 text-body text-muted">{t("inquiry.receivedText", { name: equipment.name })}</p>
          <button className="button button--secondary mt-2" onClick={close} type="button">{t("form.close")}</button>
        </div> : <>
          <p className="consult-popup__eyebrow">{t("inquiry.eyebrow")}</p>
          <div className="consult-popup__copy">
            <h2 className="mb-0 text-h3 font-bold tracking-tight text-balance text-ink" id={titleId}>{equipment.name}</h2>
            <p className="mb-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted" data-testid="equipment-inquiry-summary">
              {equipment.modelCode ? <span>{t("inquiry.modelCode")} <strong className="font-semibold text-ink">{equipment.modelCode}</strong></span> : null}
              <strong className="font-bold text-brand-700">{priceFormatter.format(equipment.priceVnd)}</strong>
              <AvailabilityBadge always availability={availability} t={t} />
            </p>
            {note ? <p className="mb-0 text-small text-muted" data-testid="equipment-inquiry-note">{note}</p> : null}
          </div>
          <form aria-label={t("inquiry.formLabel", { name: equipment.name })} className="grid gap-4" onSubmit={submit}>
            <Field label={t("form.name")} required><input autoComplete="name" className={inputClassName} enterKeyHint="next" maxLength={180} minLength={2} name="name" placeholder={t("form.namePlaceholder")} required /></Field>
            <Field label={t("form.phone")} required><PhoneInput className={inputClassName} enterKeyHint="next" /></Field>
            <Field label="Email" optional><input autoComplete="email" className={inputClassName} enterKeyHint="next" maxLength={320} name="email" placeholder={t("form.emailPlaceholder")} type="email" /></Field>
            <Field label={t("inquiry.note")} optional><textarea className={`${controlClassName} min-h-20 py-3`} maxLength={2000} name="message" placeholder={t("inquiry.notePlaceholder")} rows={3} /></Field>
            <label aria-hidden="true" className="hidden">Website<input autoComplete="off" name="website" tabIndex={-1} /></label>
            <button className="button button--primary w-full disabled:opacity-60" data-testid="equipment-inquiry-submit" disabled={busy} type="submit">{busy ? t("form.sending") : t("inquiry.submit")}</button>
            <p className="mb-0 flex items-center gap-1.5 text-caption text-faint"><ShieldCheck aria-hidden="true" size={14} />{t("form.privacy")}</p>
            {message ? <p className="mb-0 text-small font-medium text-accent-rose" role="alert">{message}</p> : null}
          </form>
          {hotline ? <p className="mb-0 flex flex-wrap items-center gap-x-2 border-t border-line pt-4 text-small text-muted"><Phone aria-hidden="true" size={16} />{t("form.callDirect")} <a className="font-bold text-ink hover:underline" href={`tel:${hotline.replace(/[^\d+]/g, "")}`}>{hotline}</a></p> : null}
        </>}
      </div>
    </div>
  </div>;
}

