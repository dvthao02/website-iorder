import { AdminPage } from "@/components/admin/ui/admin-page";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { AdminStatusBadge } from "@/components/admin/ui/admin-feedback";
import { AdminPageBarHelp, AdminPageBarMeta } from "@/components/admin/ui/admin-page-bar";
import { SeoAuditPanel } from "@/components/admin/seo-audit-panel";
import { getPublishingReadiness, getSeoAudit } from "@/lib/backend";

export async function PublishingReadinessPage() {
  const [items, seoAudit] = await Promise.all([getPublishingReadiness(), getSeoAudit()]);
  const ready = items.filter((item) => item.status === "ready").length;

  return <AdminPage>
    <h1 className="sr-only">Kiểm tra xuất bản</h1>
    <AdminPageBarMeta>{ready}/{items.length} mục đạt</AdminPageBarMeta>
    <AdminPageBarHelp>Kiểm tra cấu hình và nội dung quan trọng trước khi đưa website vào vận hành.</AdminPageBarHelp>
    <div className="admin-check-list">{items.map(item => <Link href={item.href} key={item.id}>
      <span className={item.status === "ready" ? "admin-status admin-status--ready" : "admin-status"} />
      <span><strong>{item.label}</strong><small>{item.detail}</small></span>
      <AdminStatusBadge tone={item.status === "ready" ? "success" : "warning"}>{item.status === "ready" ? "Sẵn sàng" : "Cần xử lý"}</AdminStatusBadge>
      <ChevronRight aria-hidden="true" className="admin-check-list__go" size={16} />
    </Link>)}</div>
    {seoAudit ? <SeoAuditPanel audit={seoAudit} /> : null}
  </AdminPage>;
}
