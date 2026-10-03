import { cookies } from "next/headers";
import Link from "next/link";
import { BarChart3, CalendarDays, FileText, Image, LayoutTemplate, PackagePlus, PenLine, Plus, Settings2 } from "lucide-react";

import { administratorSessionCookieName, getCurrentAdministrator } from "@/lib/backend";
import { getAnalyticsOverview } from "@/lib/backend";
import { getEquipment } from "@/lib/backend";
import { getLeads } from "@/lib/backend";
import { getAdminOfferings } from "@/lib/backend";
import { getAdminPages } from "@/lib/backend";
import { getAdminPosts } from "@/lib/backend";
import { getPublishingReadiness } from "@/lib/backend";
import { getAdminSupportDownloads } from "@/lib/backend";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { DashboardRecentTable } from "@/components/admin/dashboard-recent-table";

type ContentStatus = "draft" | "review" | "scheduled" | "published" | "archived";
type DashboardContent = { id: string; title: string; type: string; status: ContentStatus; updatedAt: Date; href: string };
type WorkItem = { label: string; detail: string; href: string };

const postTypeLabels: Record<string, string> = { news: "Tin tức", promotion: "Khuyến mãi", case_study: "Câu chuyện khách hàng", announcement: "Thông báo", guide: "Hướng dẫn" };
const offeringTypeLabels: Record<string, string> = { software: "Sản phẩm", solution: "Giải pháp", service: "Dịch vụ" };

function contentWarnings(label: string, href: string, items: Array<{ status: ContentStatus; seoTitle: string | null; seoDescription: string | null }>): WorkItem[] {
  const pending = items.filter((item) => item.status === "draft" || item.status === "review").length;
  const scheduled = items.filter((item) => item.status === "scheduled").length;
  const missingSeo = items.filter((item) => item.status === "published" && (!item.seoTitle || !item.seoDescription)).length;
  return [
    ...(pending ? [{ label: `${label}: nội dung chưa xuất bản`, detail: `${pending} mục đang là bản nháp hoặc chờ duyệt.`, href }] : []),
    ...(scheduled ? [{ label: `${label}: nội dung hẹn giờ`, detail: `${scheduled} mục đang chờ thời điểm xuất bản.`, href }] : []),
    ...(missingSeo ? [{ label: `${label}: cần bổ sung SEO`, detail: `${missingSeo} mục đã xuất bản chưa có đủ tiêu đề và mô tả SEO.`, href }] : []),
  ];
}

function offeringManagerHref(type: string) {
  if (type === "software") return "/admin/san-pham";
  if (type === "solution") return "/admin/giai-phap";
  return "/admin/dich-vu";
}

export default async function AdministratorHomePage() {
  const cookieStore = await cookies();
  const administrator = await getCurrentAdministrator(cookieStore.get(administratorSessionCookieName)?.value);
  if (!administrator) return null;

  const [analytics, readiness, pages, posts, offerings, equipment, supportDownloads, leads] = await Promise.all([
    getAnalyticsOverview(), getPublishingReadiness(), getAdminPages(), getAdminPosts(), getAdminOfferings(), getEquipment(), getAdminSupportDownloads(), getLeads(),
  ]);
  const products = offerings.filter((item) => item.type === "software");
  const solutions = offerings.filter((item) => item.type === "solution");
  const services = offerings.filter((item) => item.type === "service");
  const contentSummary = [
    { label: "Trang website", value: pages.length, detail: `${pages.filter((item) => item.status === "published").length} trang đã xuất bản`, href: "/admin/pages", icon: FileText },
    { label: "Bài viết & Tin tức", value: posts.filter((item) => item.type !== "guide").length, detail: `${posts.filter((item) => item.type !== "guide" && item.status === "published").length} bài đã xuất bản`, href: "/admin/tin-tuc", icon: PenLine },
    { label: "Sản phẩm", value: products.length, detail: `${products.filter((item) => item.status === "published").length} sản phẩm đã xuất bản`, href: "/admin/san-pham", icon: PackagePlus },
    { label: "Giải pháp", value: solutions.length, detail: `${solutions.filter((item) => item.status === "published").length} giải pháp đã xuất bản`, href: "/admin/giai-phap", icon: LayoutTemplate },
    { label: "Dịch vụ", value: services.length, detail: `${services.filter((item) => item.status === "published").length} dịch vụ đã xuất bản`, href: "/admin/dich-vu", icon: Settings2 },
    { label: "Thiết bị", value: equipment.length, detail: `${equipment.filter((item) => item.status === "published").length} thiết bị đã xuất bản`, href: "/admin/thiet-bi", icon: PackagePlus },
    { label: "Tài nguyên", value: supportDownloads.length, detail: `${supportDownloads.filter((item) => item.isEnabled).length} tệp đang hiển thị`, href: "/admin/tai-nguyen", icon: Image },
    { label: "Khách hàng tiềm năng", value: leads.length, detail: `${leads.filter((item) => item.status === "new").length} liên hệ mới cần xử lý`, href: "/admin/khach-hang-tiem-nang", icon: FileText },
  ];
  const quickActions = [
    { href: "/admin/pages/new", label: "Tạo trang mới", icon: FileText },
    { href: "/admin/tin-tuc/moi", label: "Viết bài viết", icon: PenLine },
    { href: "/admin/san-pham/moi", label: "Thêm sản phẩm", icon: PackagePlus },
    { href: "/admin/media", label: "Tải lên media", icon: Image },
  ];
  const contentForRecent: DashboardContent[] = [
    ...pages.map((item) => ({ id: item.id, title: item.title, type: "Trang website", status: item.status, updatedAt: item.updatedAt, href: `/admin/pages/${item.id}` })),
    ...posts.map((item) => ({ id: item.id, title: item.title, type: postTypeLabels[item.type] ?? "Bài viết", status: item.status, updatedAt: item.updatedAt, href: item.type === "guide" ? `/admin/tai-nguyen/huong-dan/${item.id}` : `/admin/tin-tuc/${item.id}` })),
    ...offerings.filter((item) => item.type !== "industry").map((item) => ({ id: item.id, title: item.title, type: offeringTypeLabels[item.type] ?? "Nội dung catalog", status: item.status, updatedAt: item.updatedAt, href: `${offeringManagerHref(item.type)}/${item.id}` })),
    ...equipment.map((item) => ({ id: item.id, title: item.name, type: "Thiết bị", status: item.status, updatedAt: item.updatedAt, href: `/admin/thiet-bi/${item.id}` })),
  ].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()).slice(0, 8);
  const workItems = [
    ...contentWarnings("Trang website", "/admin/pages", pages),
    ...contentWarnings("Bài viết & Tin tức", "/admin/tin-tuc", posts),
    ...contentWarnings("Sản phẩm", "/admin/san-pham", products),
    ...contentWarnings("Giải pháp", "/admin/giai-phap", solutions),
    ...contentWarnings("Dịch vụ", "/admin/dich-vu", services),
    ...contentWarnings("Thiết bị", "/admin/thiet-bi", equipment),
    ...readiness.filter((item) => item.status === "attention").map((item) => ({ label: item.label, detail: item.detail, href: item.href })),
  ].slice(0, 6);
  const readyChecks = readiness.filter((item) => item.status === "ready").length;

  return <div className="admin-dashboard admin-dashboard--overview">
    <AdminCard className="admin-dashboard__hero">
      <div><p>Chào mừng trở lại,</p><h1>{administrator.fullName} <span aria-hidden="true">👋</span></h1><small>Quản lý nội dung và theo dõi tình trạng website từ một nơi.</small></div>
      <div className="admin-dashboard__hero-actions"><Link className="admin-dashboard__period" href="/admin/analytics"><CalendarDays aria-hidden="true" size={16} />Dữ liệu {analytics.periodDays} ngày</Link><Link className="admin-dashboard__hero-primary" href="/admin/pages/new"><Plus aria-hidden="true" size={16} />Tạo nội dung</Link></div>
    </AdminCard>

    <div className="admin-dashboard__layout">
      <div className="admin-dashboard__primary">
        <section aria-label="Tóm tắt truy cập" className="admin-dashboard__traffic-metrics">
          {[["Lượt truy cập", analytics.visits], ["Người dùng mới", null], ["Số trang xem", null], ["Thời gian trung bình", null]].map(([label, value]) => <AdminCard className="admin-dashboard__traffic-metric" key={String(label)}><BarChart3 aria-hidden="true" size={19} /><div><span>{label}</span><strong>{value ?? "—"}</strong><small>Chưa kết nối dữ liệu</small></div></AdminCard>)}
        </section>
        <section className="admin-dashboard__analytics-grid" aria-label="Dữ liệu truy cập">
          <AdminCard className="admin-dashboard__analytics-panel admin-dashboard__analytics-panel--chart"><header><h2>Lượt truy cập website</h2><Link href="/admin/analytics">Xem thống kê →</Link></header><div className="admin-dashboard__analytics-empty"><BarChart3 aria-hidden="true" size={28} /><strong>Chưa có dữ liệu truy cập</strong><span>Khi kết nối nguồn thống kê, biểu đồ 7 ngày sẽ hiển thị tại đây.</span></div></AdminCard>
          <AdminCard className="admin-dashboard__analytics-panel"><header><h2>Nguồn truy cập</h2></header><div className="admin-dashboard__analytics-empty"><span>Chưa có nguồn dữ liệu</span></div></AdminCard>
        </section>
        <AdminCard className="admin-dashboard__content-summary"><header><h2>Tổng quan nội dung</h2><Link href="/admin/pages">Xem nội dung →</Link></header><div>{contentSummary.map((item) => { const Icon = item.icon; return <Link href={item.href} key={item.label}><span><Icon aria-hidden="true" size={19} /></span><b>{item.value}</b><strong>{item.label}</strong><small>{item.detail}</small></Link>; })}</div></AdminCard>
        <AdminCard className="admin-dashboard__recent"><header><div><h2>Nội dung gần đây</h2><p>Các nội dung được cập nhật mới nhất trong CMS.</p></div><Link className="admin-dashboard__create-link" href="/admin/pages/new"><Plus aria-hidden="true" size={15} />Tạo mới</Link></header><DashboardRecentTable items={contentForRecent} /></AdminCard>
      </div>
      <aside className="admin-dashboard__aside">
        <AdminCard className="admin-dashboard__quick"><h2>Thao tác nhanh</h2><div>{quickActions.map((action) => { const Icon = action.icon; return <Link href={action.href} key={action.label}><span><Icon aria-hidden="true" size={21} /></span><strong>{action.label}</strong></Link>; })}</div></AdminCard>
        <AdminCard className="admin-dashboard__readiness"><header><div><h2>Tình trạng xuất bản</h2><p>{readyChecks}/{readiness.length} kiểm tra sẵn sàng</p></div><Link href="/admin/seo/kiem-tra-xuat-ban">Chi tiết →</Link></header><div>{readiness.slice(0, 4).map((item) => <Link href={item.href} key={item.id}><i className={item.status === "ready" ? "admin-status admin-status--ready" : "admin-status"} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>)}</div></AdminCard>
        <AdminCard className="admin-dashboard__work"><header><div><h2>Công việc cần chú ý</h2><p>Chỉ hiển thị dữ liệu cần xử lý.</p></div><Link href="/admin/seo/kiem-tra-xuat-ban">Xem tất cả →</Link></header>{workItems.length ? <div>{workItems.map((item) => <Link href={item.href} key={`${item.label}-${item.detail}`}><i className="admin-status" /><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>)}</div> : <p className="admin-dashboard__empty">Chưa có công việc cần xử lý.</p>}</AdminCard>
      </aside>
    </div>
  </div>;
}
