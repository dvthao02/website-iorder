"use client";

import { ArrowRight, ChevronDown, Clock, Mail, MapPin, Phone } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

type Contact = { hotline: string | null; email: string | null; workingHours: string | null; address?: string | null };
type LeadFormProps = { title: string; description: string | null; submitLabel: string; needOptions: string[]; trialTitle?: string | null; trialLabel?: string | null; dark?: boolean; trialUrl?: string | null; contact?: Contact | null };

const controlClassName = "w-full rounded-control border border-line bg-white px-4 text-body text-ink transition placeholder:text-faint hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none";
const inputClassName = `${controlClassName} h-12`;

function Field({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return <label className={`grid content-start gap-1.5 text-small font-semibold text-ink ${className}`.trim()}><span>{label}{required ? <span aria-hidden="true" className="ml-0.5 text-accent-rose">*</span> : null}</span>{children}</label>;
}

// Khối "Để lại thông tin": hai cột trên máy tính, một cột trên điện thoại.
// Trái: lời mời, liên hệ trực tiếp (hotline, email, giờ làm việc lấy từ Cài đặt › Thông tin website) và lối tắt Đăng ký dùng thử
// (tự dùng thử phần mềm khác với nhờ tư vấn triển khai). Phải: biểu mẫu ngắn — chỉ họ tên và số điện thoại bắt buộc.
export function LeadForm({ title, description, submitLabel, needOptions, trialTitle, trialLabel, dark = false, trialUrl = null, contact = null }: LeadFormProps) {
  const contactRows = contact ? [
    contact.hotline ? { icon: Phone, label: contact.hotline, href: `tel:${contact.hotline.replace(/[^\d+]/g, "")}` } : null,
    contact.email ? { icon: Mail, label: contact.email, href: `mailto:${contact.email}` } : null,
    contact.address ? { icon: MapPin, label: contact.address, href: null } : null,
    contact.workingHours ? { icon: Clock, label: contact.workingHours, href: null } : null,
  ].filter(row => row !== null) : [];
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    // currentTarget is cleared once the event finishes dispatching, so keep the form before awaiting.
    const formElement = event.currentTarget;
    const payload = Object.fromEntries(new FormData(formElement).entries());
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
      if (response.ok) {
        formElement.reset();
        setSuccess(true);
        setMessage(body?.message ?? "Đã gửi thông tin. iOrder sẽ liên hệ lại sớm.");
      } else {
        setSuccess(false);
        setMessage(body?.error?.message ?? "Không thể gửi liên hệ. Vui lòng thử lại sau.");
      }
    } catch { setSuccess(false); setMessage("Không kết nối được máy chủ. Vui lòng thử lại sau."); }
    finally { setBusy(false); }
  }
  return <div className="lead-form-layout grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
    <div className="lg:sticky lg:top-28" data-testid="lead-contact">
      <h2 className={`mb-0 text-h2 font-bold tracking-tight text-balance ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
      {description ? <p className={`mt-4 mb-0 text-lead ${dark ? "text-white/80" : "text-muted"}`}>{description}</p> : null}
      {contactRows.length ? <ul className="m-0 mt-8 grid list-none gap-3 p-0">{contactRows.map(({ icon: Icon, label, href }) => <li className={`flex items-center gap-3 text-body font-semibold ${dark ? "text-white" : "text-ink"}`} key={label}>
        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-control ${dark ? "bg-white/10 text-white" : "bg-white text-brand-600 shadow-card"}`}><Icon size={18} /></span>
        {href ? <a className="hover:text-brand-700 hover:underline" href={href}>{label}</a> : <span className={dark ? "text-white/80" : "font-medium text-muted"}>{label}</span>}
      </li>)}</ul> : null}
      {trialUrl ? <div className={`mt-8 rounded-card border p-5 ${dark ? "border-white/20 bg-white/10" : "border-line bg-white shadow-card"}`}>
        <p className={`mb-3 text-body font-semibold ${dark ? "text-white" : "text-ink"}`}>{trialTitle || "Muốn tự trải nghiệm trước?"}</p>
        <a className="button button--primary" href={trialUrl} rel="noopener noreferrer" target="_blank">{trialLabel || "Đăng ký dùng thử"}<ArrowRight aria-hidden="true" size={18} /></a>
      </div> : null}
    </div>
    <form aria-label="Biểu mẫu liên hệ" data-testid="lead-form" className="grid gap-5 rounded-card border border-line bg-white p-6 shadow-raised sm:grid-cols-2 sm:p-8" onSubmit={submit}>
      <Field label="Họ và tên" required><input autoComplete="name" className={inputClassName} name="name" placeholder="Nguyễn Văn A" required /></Field>
      <Field label="Số điện thoại" required><input autoComplete="tel" className={inputClassName} inputMode="tel" name="phone" placeholder="09xx xxx xxx" required /></Field>
      <Field label="Email"><input autoComplete="email" className={inputClassName} name="email" placeholder="ten@congty.vn" type="email" /></Field>
      <Field label="Nhu cầu chính">{needOptions.length
        ? <div className="relative"><select className={`${inputClassName} appearance-none pr-10`} name="need"><option value="">Chọn nhu cầu</option>{needOptions.map(option => <option key={option}>{option}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted" size={18} /></div>
        : <input className={inputClassName} name="need" />}</Field>
      <label aria-hidden="true" className="hidden">Website<input autoComplete="off" name="website" tabIndex={-1} /></label>
      <Field className="sm:col-span-2" label="Mô tả thêm"><textarea className={`${controlClassName} min-h-28 py-3`} name="message" placeholder="Mô hình kinh doanh, số chi nhánh, điều bạn cần tư vấn…" rows={4} /></Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button data-testid="lead-submit" className="button button--primary w-full disabled:opacity-60 sm:w-fit" disabled={busy} type="submit">{busy ? "Đang gửi…" : submitLabel}</button>
        <p className={`mb-0 text-small font-medium ${success ? "text-accent-green" : "text-accent-rose"}`} role="status">{message}</p>
      </div>
    </form>
  </div>;
}
