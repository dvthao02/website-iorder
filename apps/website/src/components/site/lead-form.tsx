"use client";

import { ArrowRight, ChevronDown, Clock, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import React, { useEffect, useState, type FormEvent, type ReactNode } from "react";
// Đường dẫn tương đối (không dùng "@/"): bài kiểm thử chạy từ thư mục gốc, nơi bí danh "@/" chưa được khai báo.
import { addressLines } from "../../lib/address-lines";
import { submitLead, warmLeadToken } from "../../lib/submit-lead";
import { useT } from "./messages-provider";
import { PhoneInput } from "./phone-input";

type Contact = { hotline: string | null; email: string | null; workingHours: string | null; address?: string | null };
type LeadFormProps = { title: string; description: string | null; submitLabel: string; needOptions: string[]; trialTitle?: string | null; trialLabel?: string | null; dark?: boolean; trialUrl?: string | null; contact?: Contact | null };

export const controlClassName = "w-full rounded-control border border-line bg-white px-4 text-body text-ink transition placeholder:text-faint hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none";
export const inputClassName = `${controlClassName} h-12`;

export function Field({ label, required, optional, className = "", children }: { label: string; required?: boolean; optional?: boolean; className?: string; children: ReactNode }) {
  const t = useT();
  return <label className={`grid content-start gap-1.5 text-small font-semibold text-ink ${className}`.trim()}><span>{label}{required ? <span aria-hidden="true" className="ml-0.5 text-accent-rose">*</span> : null}{optional ? <span className="ml-1.5 text-caption font-normal text-faint">{t("form.optional")}</span> : null}</span>{children}</label>;
}

// Khối "Để lại thông tin": hai cột trên máy tính, một cột trên điện thoại.
// Trái: lời mời, các cách liên hệ trực tiếp (hotline, email, giờ làm việc lấy từ Cài đặt › Thông tin website; mỗi dòng có nhãn) và lối đi phụ
// "Dùng thử" (nút viền, để nút Gửi của biểu mẫu là hành động chính duy nhất). Phải: biểu mẫu ngắn — chỉ họ tên và số điện thoại bắt buộc.
export function LeadForm({ title, description, submitLabel, needOptions, trialTitle, trialLabel, dark = false, trialUrl = null, contact = null }: LeadFormProps) {
  const t = useT();
  const contactRows = contact ? [
    contact.hotline ? { icon: Phone, caption: t("lead.hotlineCaption"), label: contact.hotline, href: `tel:${contact.hotline.replace(/[^\d+]/g, "")}`, strong: true } : null,
    contact.email ? { icon: Mail, caption: t("lead.emailCaption"), label: contact.email, href: `mailto:${contact.email}`, strong: false } : null,
    ...addressLines(contact.address).map(line => ({ icon: MapPin, caption: t("lead.addressCaption"), label: line.text, href: null, strong: false })),
    contact.workingHours ? { icon: Clock, caption: t("lead.workingHoursCaption"), label: contact.workingHours, href: null, strong: false } : null,
  ].filter(row => row !== null) : [];
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  // Xin mã phiên gửi ngay khi biểu mẫu hiện ra để lúc bấm Gửi mã đã đủ tuổi (chống gửi tự động, xem leads.guard.ts).
  useEffect(() => { warmLeadToken(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    // currentTarget is cleared once the event finishes dispatching, so keep the form before awaiting.
    const formElement = event.currentTarget;
    const result = await submitLead(Object.fromEntries(new FormData(formElement).entries()), t);
    if (result.ok) formElement.reset();
    setSuccess(result.ok);
    setMessage(result.message);
    setBusy(false);
  }
  return <div className="lead-form-layout grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
    <div className="lg:sticky lg:top-28" data-testid="lead-contact">
      <h2 className={`mb-0 text-h2 font-bold tracking-tight text-balance ${dark ? "text-white" : "text-ink"}`} data-builder-field="title">{title}</h2>
      {description ? <p className={`mt-4 mb-0 text-lead ${dark ? "text-white/80" : "text-muted"}`} data-builder-field="description">{description}</p> : null}
      {contactRows.length ? <ul className="m-0 mt-8 grid list-none gap-4 p-0">{contactRows.map(({ icon: Icon, caption, label, href, strong }) => <li className="flex items-center gap-4" key={`${caption}-${label}`}>
        <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-control ${dark ? "bg-white/10 text-white" : "bg-brand-50 text-brand-600"}`}><Icon size={20} /></span>
        <span className="grid min-w-0 gap-0.5">
          <span className={`text-caption font-semibold tracking-wide uppercase ${dark ? "text-white/60" : "text-faint"}`}>{caption}</span>
          {href
            ? <a className={`break-words hover:underline ${strong ? "text-h3 font-bold" : "text-body font-semibold"} ${dark ? "text-white" : "text-ink hover:text-brand-700"}`} href={href}>{label}</a>
            : <span className={`text-body font-semibold ${dark ? "text-white/90" : "text-ink"}`}>{label}</span>}
        </span>
      </li>)}</ul> : null}
      {trialUrl ? <div className={`mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-6 ${dark ? "border-white/20" : "border-line"}`}>
        <p className={`mb-0 text-body font-semibold ${dark ? "text-white" : "text-ink"}`} data-builder-field="trialTitle">{trialTitle || t("lead.trialTitleDefault")}</p>
        <a className={`button ${dark ? "button--outline-light" : "button--secondary"}`} href={trialUrl} rel="noopener noreferrer" target="_blank">{trialLabel || t("lead.trialLabelDefault")}<ArrowRight aria-hidden="true" size={18} /></a>
      </div> : null}
    </div>
    <form aria-label={t("lead.formLabel")} data-testid="lead-form" className="grid gap-5 rounded-card border border-line bg-white p-6 shadow-raised sm:grid-cols-2 sm:p-8" onSubmit={submit}>
      <div className="sm:col-span-2">
        <p className="mb-1 text-h3 font-bold text-ink">{t("lead.inviteTitle")}</p>
        <p className="mb-0 text-small text-muted">{t("lead.inviteHint")}</p>
      </div>
      <Field label={t("form.name")} required><input autoComplete="name" className={inputClassName} name="name" placeholder={t("form.namePlaceholder")} required /></Field>
      <Field label={t("form.phone")} required><PhoneInput className={inputClassName} /></Field>
      <Field label={t("form.need")} optional>{needOptions.length
        ? <div className="relative" data-builder-field="needOptions"><select className={`${inputClassName} appearance-none pr-10`} name="need"><option value="">{t("form.needPlaceholder")}</option>{needOptions.map(option => <option key={option}>{option}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted" size={18} /></div>
        : <input className={inputClassName} name="need" />}</Field>
      <Field label="Email" optional><input autoComplete="email" className={inputClassName} name="email" placeholder={t("form.emailPlaceholder")} type="email" /></Field>
      <label aria-hidden="true" className="hidden">Website<input autoComplete="off" name="website" tabIndex={-1} /></label>
      <Field className="sm:col-span-2" label={t("lead.messageLabel")} optional><textarea className={`${controlClassName} min-h-24 py-3`} name="message" placeholder={t("lead.messagePlaceholder")} rows={3} /></Field>
      <div className="grid gap-3 sm:col-span-2">
        <button data-testid="lead-submit" className="button button--primary w-full disabled:opacity-60" disabled={busy} type="submit"><span data-builder-field="submitLabel">{busy ? t("form.sending") : submitLabel}</span></button>
        <p className="mb-0 flex items-center gap-1.5 text-caption text-faint"><ShieldCheck aria-hidden="true" size={14} />{t("form.privacy")}</p>
        <p className={`mb-0 text-small font-medium ${success ? "text-accent-green" : "text-accent-rose"}`} role="status">{message}</p>
      </div>
    </form>
  </div>;
}
