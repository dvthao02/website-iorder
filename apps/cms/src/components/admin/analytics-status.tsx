import Link from "next/link";

import type { AnalyticsOverview } from "@iorder/core/server/analytics/analytics.service";

export function AnalyticsStatus({ overview, compact = false }: { overview: AnalyticsOverview; compact?: boolean }) {
  if (compact) {
    return <Link className="admin-dashboard__analytics" href="/admin/analytics"><span className="admin-status" /><span><strong>Truy cập {overview.periodDays} ngày</strong><small>Chưa kết nối dữ liệu truy cập</small></span><b>Xem thống kê →</b></Link>;
  }

  return <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <header><p className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-700">Thống kê & truy cập</p><h1 className="mb-2 text-3xl font-bold text-slate-950">Chưa kết nối dữ liệu truy cập</h1><p className="mb-0 max-w-2xl leading-7 text-slate-600">CMS chưa nhận được số liệu thật từ công cụ thống kê website, nên sẽ không hiển thị số liệu ước lượng hoặc số liệu mẫu.</p></header>
    <div className="admin-analytics-warning rounded-xl p-5"><strong className="block">Khi kết nối xong, bạn sẽ xem được gì?</strong><ul className="mt-3 grid gap-2 pl-5 text-sm leading-6"><li>Tổng lượt truy cập theo khoảng thời gian.</li><li>Lượt xem theo từng Trang website, Bài viết, Sản phẩm hoặc Thiết bị.</li><li>Mỗi số liệu được đối chiếu theo đường dẫn website, slug và nội dung tương ứng.</li></ul></div>
    <p className="mb-0 text-sm text-slate-600">Việc liên kết công cụ thống kê sẽ được bổ sung khi có tài khoản và quyền truy cập dữ liệu thật.</p>
  </section>;
}
