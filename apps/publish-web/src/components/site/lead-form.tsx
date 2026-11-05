"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

type LeadFormProps = { title: string; description: string | null; submitLabel: string; needOptions: string[]; trialTitle?: string | null; trialLabel?: string | null; dark?: boolean; trialUrl?: string | null };

const controlClassName = "w-full rounded-control border border-line bg-white px-4 text-body text-ink transition placeholder:text-faint hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none";
const inputClassName = `${controlClassName} h-12`;

function Field({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return <label className={`grid content-start gap-1.5 text-small font-semibold text-ink ${className}`.trim()}><span>{label}{required ? <span aria-hidden="true" className="ml-0.5 text-accent-rose">*</span> : null}</span>{children}</label>;
}

// Khối "Để lại thông tin": hai cột trên máy tính (lời mời + lối tắt Đăng ký dùng thử bên trái, biểu mẫu trong thẻ trắng bên phải), một cột trên điện thoại.
// Thông tin liên hệ nằm ở chân trang nên không nhắc lại ở đây.
export function LeadForm({ title, description, submitLabel, needOptions, trialTitle, trialLabel, dark = false, trialUrl = null }: LeadFormProps) {
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
  return <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
    <div className="lg:sticky lg:top-28">
      <h2 className={`mb-0 text-h2 font-bold tracking-tight text-balance ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
      {description ? <p className={`mt-4 mb-0 text-lead ${dark ? "text-white/80" : "text-muted"}`}>{description}</p> : null}
      {trialUrl ? <div className={`mt-8 rounded-card border p-5 ${dark ? "border-white/20 bg-white/10" : "border-line bg-white shadow-card"}`}>
        <p className={`mb-3 text-body font-semibold ${dark ? "text-white" : "text-ink"}`}>{trialTitle || "Muốn tự trải nghiệm trước?"}</p>
        <a className="button button--primary" href={trialUrl} rel="noopener noreferrer" target="_blank">{trialLabel || "Đăng ký dùng thử"}<ArrowRight aria-hidden="true" size={18} /></a>
      </div> : null}
    </div>
    <form className="grid gap-5 rounded-card border border-line bg-white p-6 shadow-raised sm:grid-cols-2 sm:p-8" onSubmit={submit}>
      <Field label="Họ và tên" required><input autoComplete="name" className={inputClassName} name="name" placeholder="Nguyễn Văn A" required /></Field>
      <Field label="Số điện thoại" required><input autoComplete="tel" className={inputClassName} inputMode="tel" name="phone" placeholder="09xx xxx xxx" required /></Field>
      <Field label="Email"><input autoComplete="email" className={inputClassName} name="email" placeholder="ten@congty.vn" type="email" /></Field>
      <Field label="Mô hình kinh doanh"><input className={inputClassName} name="businessModel" placeholder="VD: quán cà phê, bán lẻ" /></Field>
      <Field label="Số chi nhánh/quầy"><input className={inputClassName} name="branches" placeholder="VD: 1 chi nhánh, 2 quầy" /></Field>
      <Field label="Nhu cầu chính">{needOptions.length
        ? <div className="relative"><select className={`${inputClassName} appearance-none pr-10`} name="need"><option value="">Chọn nhu cầu</option>{needOptions.map(option => <option key={option}>{option}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted" size={18} /></div>
        : <input className={inputClassName} name="need" />}</Field>
      <label aria-hidden="true" className="hidden">Website<input autoComplete="off" name="website" tabIndex={-1} /></label>
      <Field className="sm:col-span-2" label="Mô tả thêm"><textarea className={`${controlClassName} min-h-28 py-3`} name="message" placeholder="Bạn đang cần tư vấn điều gì?" rows={4} /></Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button className="button button--primary w-full disabled:opacity-60 sm:w-fit" disabled={busy} type="submit">{busy ? "Đang gửi…" : submitLabel}</button>
        <p className={`mb-0 text-small font-medium ${success ? "text-accent-green" : "text-accent-rose"}`} role="status">{message}</p>
      </div>
    </form>
  </div>;
}
