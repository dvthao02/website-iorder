import Link from "next/link";

import { AdminStatusBadge } from "@/components/admin/ui/admin-feedback";
import { getPublishingReadiness } from "@/lib/backend";

export async function PublishingReadinessPage() {
  const items = await getPublishingReadiness();

  return <main className="admin-settings-page">
    <section className="admin-settings-page__section">
      <Link className="text-sm font-bold text-blue-700 hover:underline" href="/admin/seo">← Quay lại SEO & Xuất bản</Link>
      <h1 className="mb-2 mt-5 text-3xl font-bold text-slate-950">Kiểm tra sẵn sàng xuất bản</h1>
      <p className="mb-6 max-w-3xl leading-7 text-slate-600">Kiểm tra các cấu hình và nội dung quan trọng trước khi đưa website vào vận hành chính thức.</p>
      <div className="grid gap-3">{items.map(item => <Link className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50" href={item.href} key={item.id}>
        <span className={item.status === "ready" ? "admin-status admin-status--ready" : "admin-status"} />
        <span><strong className="block text-slate-900">{item.label}</strong><small className="mt-1 block text-slate-600">{item.detail}</small></span>
        <AdminStatusBadge tone={item.status === "ready" ? "success" : "warning"}>{item.status === "ready" ? "Sẵn sàng" : "Cần xử lý"}</AdminStatusBadge>
      </Link>)}</div>
    </section>
  </main>;
}
