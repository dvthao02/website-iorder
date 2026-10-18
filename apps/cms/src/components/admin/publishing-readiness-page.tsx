import Link from "next/link";

import { AdminStatusBadge } from "@/components/admin/ui/admin-feedback";
import { AdminPageBarMeta } from "@/components/admin/ui/admin-page-bar";
import { getPublishingReadiness } from "@/lib/backend";

export async function PublishingReadinessPage() {
  const items = await getPublishingReadiness();
  const ready = items.filter((item) => item.status === "ready").length;

  return <main className="admin-settings-page">
    <h1 className="sr-only">Kiểm tra xuất bản</h1>
    <AdminPageBarMeta>{ready}/{items.length} mục đạt</AdminPageBarMeta>
    <p className="admin-help">Kiểm tra cấu hình và nội dung quan trọng trước khi đưa website vào vận hành.</p>
    <div className="admin-check-list">{items.map(item => <Link href={item.href} key={item.id}>
      <span className={item.status === "ready" ? "admin-status admin-status--ready" : "admin-status"} />
      <span><strong>{item.label}</strong><small>{item.detail}</small></span>
      <AdminStatusBadge tone={item.status === "ready" ? "success" : "warning"}>{item.status === "ready" ? "Sẵn sàng" : "Cần xử lý"}</AdminStatusBadge>
    </Link>)}</div>
  </main>;
}
