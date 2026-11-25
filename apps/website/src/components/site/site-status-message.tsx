"use client";

import { CloudOff, RefreshCw, SearchX } from "lucide-react";
import { useT } from "@/components/site/messages-provider";
import { SiteLink as Link } from "@/components/site/site-link";

// Khối thông báo dùng chung cho trang 404 và trang lỗi; không gọi Backend để vẫn hiển thị khi Backend lỗi.
// `kind="not-found"`: biểu tượng tìm kiếm, nút chính "Về trang chủ" và nút phụ "Liên hệ hỗ trợ".
// `kind="error"`: biểu tượng mất kết nối; có `onRetry` thì nút chính là "Thử lại" và "Về trang chủ" thành nút phụ.
// Chỉ dùng token màu/chữ và lớp .button của site (không dùng màu Tailwind trực tiếp); vệt sáng nền là .soft-glow (chỉ trang trí).
const icons = { "not-found": SearchX, error: CloudOff } as const;

export function SiteStatusMessage({ eyebrow, title, description, kind = "not-found", onRetry }: { eyebrow: string; title: string; description: string; kind?: keyof typeof icons; onRetry?: () => void }) {
  const Icon = icons[kind];
  const t = useT();
  return <main className="relative isolate grid min-h-[60vh] content-center overflow-clip" id="noi-dung">
    <span aria-hidden="true" className="soft-glow top-1/2 left-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 opacity-80" />
    <div className="mx-auto grid max-w-2xl justify-items-center gap-4 px-6 py-16 text-center">
      <span aria-hidden="true" className="mb-2 grid size-16 place-items-center rounded-card bg-brand-600 text-white shadow-brand"><Icon size={30} strokeWidth={1.8} /></span>
      <p className="mb-0 text-small font-bold tracking-wide text-brand-700 uppercase">{eyebrow}</p>
      <h1 className="mb-0 text-display font-bold tracking-tight text-balance text-ink">{title}</h1>
      <p className="mb-0 max-w-xl text-lead text-balance text-muted">{description}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {onRetry ? <button className="button button--primary" onClick={onRetry} type="button"><RefreshCw aria-hidden="true" size={18} />{t("status.retry")}</button> : null}
        <Link className={`button ${onRetry ? "button--secondary" : "button--primary"}`} href="/">{t("status.backHome")}</Link>
        {kind === "not-found" ? <Link className="button button--secondary" href="/contact">{t("status.contactSupport")}</Link> : null}
      </div>
    </div>
  </main>;
}
