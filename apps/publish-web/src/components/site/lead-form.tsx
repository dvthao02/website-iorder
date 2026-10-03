"use client";

import { useState, type FormEvent } from "react";

type LeadFormProps = { title: string; description: string | null; submitLabel: string; needOptions: string[] };
const inputClassName = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900";

export function LeadForm({ title, description, submitLabel, needOptions }: LeadFormProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      setMessage(response.ok ? body.message : (body.error?.message ?? "Không thể gửi liên hệ."));
      if (response.ok) event.currentTarget.reset();
    } catch { setMessage("Không kết nối được máy chủ. Vui lòng thử lại sau."); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-3xl px-6 py-12 sm:py-16"><div className="rounded-2xl bg-slate-900 p-6 text-white sm:p-8"><h2 className="text-3xl font-extrabold">{title}</h2>{description ? <p className="mt-3 text-slate-200">{description}</p> : null}<form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}><label>Họ và tên<input className={inputClassName} name="name" required /></label><label>Số điện thoại<input className={inputClassName} name="phone" inputMode="tel" required /></label><label>Email<input className={inputClassName} name="email" type="email" /></label><label>Mô hình kinh doanh<input className={inputClassName} name="businessModel" /></label><label>Số chi nhánh/quầy<input className={inputClassName} name="branches" placeholder="Ví dụ: 1 chi nhánh, 2 quầy" /></label><label>Nhu cầu chính{needOptions.length ? <select className={inputClassName} name="need"><option value="">Chọn nhu cầu</option>{needOptions.map(option => <option key={option}>{option}</option>)}</select> : <input className={inputClassName} name="need" />}</label><label className="hidden" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label><label className="sm:col-span-2">Mô tả thêm<textarea className={inputClassName} name="message" rows={4} /></label><button className="rounded-lg bg-blue-600 px-5 py-3 font-bold disabled:opacity-60 sm:w-fit" disabled={busy}>{busy ? "Đang gửi…" : submitLabel}</button><p className="sm:col-span-2" role="status">{message}</p></form></div></section>;
}
