"use client";

import { useState, type FormEvent } from "react";

type LeadFormProps = { title: string; description: string | null; submitLabel: string; needOptions: string[] };
const inputClassName = "w-full rounded-control border border-line bg-white px-3 py-2 text-body text-ink";

export function LeadForm({ title, description, submitLabel, needOptions }: LeadFormProps) {
  const [message, setMessage] = useState("");
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
        setMessage(body?.message ?? "Đã gửi thông tin. iOrder sẽ liên hệ lại sớm.");
      } else {
        setMessage(body?.error?.message ?? "Không thể gửi liên hệ. Vui lòng thử lại sau.");
      }
    } catch { setMessage("Không kết nối được máy chủ. Vui lòng thử lại sau."); }
    finally { setBusy(false); }
  }
  return <div className="rounded-card bg-gradient-to-br from-brand-800 to-brand-950 p-6 text-white shadow-raised sm:p-8"><h2 className="mb-0 text-h2 font-bold tracking-tight">{title}</h2>{description ? <p className="mt-3 mb-0 text-lead text-white/80">{description}</p> : null}<form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}><label>Họ và tên<input className={inputClassName} name="name" autoComplete="name" required /></label><label>Số điện thoại<input className={inputClassName} name="phone" autoComplete="tel" inputMode="tel" required /></label><label>Email<input className={inputClassName} name="email" autoComplete="email" type="email" /></label><label>Mô hình kinh doanh<input className={inputClassName} name="businessModel" /></label><label>Số chi nhánh/quầy<input className={inputClassName} name="branches" placeholder="Ví dụ: 1 chi nhánh, 2 quầy" /></label><label>Nhu cầu chính{needOptions.length ? <select className={inputClassName} name="need"><option value="">Chọn nhu cầu</option>{needOptions.map(option => <option key={option}>{option}</option>)}</select> : <input className={inputClassName} name="need" />}</label><label className="hidden" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label><label className="sm:col-span-2">Mô tả thêm<textarea className={inputClassName} name="message" rows={4} /></label><button className="button button--primary disabled:opacity-60 sm:w-fit" disabled={busy} type="submit">{busy ? "Đang gửi…" : submitLabel}</button><p className="sm:col-span-2" role="status">{message}</p></form></div>;
}
