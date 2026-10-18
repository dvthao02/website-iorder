import Link from "next/link";
import type { ReactNode } from "react";

// Khối thông báo dùng chung cho trang 404 và trang lỗi; không gọi Backend để vẫn hiển thị khi Backend lỗi.
export function SiteStatusMessage({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <main className="mx-auto grid min-h-[60vh] max-w-2xl content-center gap-4 px-6 py-16 text-center">
    <p className="text-sm font-bold uppercase tracking-wide text-blue-700">{eyebrow}</p>
    <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">{title}</h1>
    <p className="text-slate-600">{description}</p>
    <div className="mt-2 flex flex-wrap justify-center gap-3">{action}<Link className="rounded-lg border border-slate-300 px-5 py-3 font-bold text-slate-800 hover:bg-slate-50" href="/">Về trang chủ</Link></div>
  </main>;
}
