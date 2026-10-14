import { cookies } from "next/headers";
import Link from "next/link";
import { BarChart3, CalendarDays, FileText, Image, LayoutTemplate, PackagePlus, PenLine, Plus, Settings2 } from "lucide-react";

import { AdminCard } from "@/components/admin/ui/admin-card";
import { DashboardRecentTable } from "@/components/admin/dashboard-recent-table";
import { administratorSessionCookieName, getAnalyticsOverview, getCurrentAdministrator, getDashboardContentSummary, getPublishingReadiness } from "@/lib/backend";

type ContentStatus = "draft" | "review" | "scheduled" | "published" | "archived";
type DashboardContent = { id: string; title: string; type: string; status: ContentStatus; updatedAt: Date; href: string };
type WorkItem = { label: string; detail: string; href: string };
type ContentStats = { missingSeo: number; pending: number; scheduled: number };

const postTypeLabels: Record<string, string> = { news: "Tin tức", promotion: "Khuyến mãi", case_study: "Câu chuyện khách hàng", announcement: "Thông báo", guide: "Hướng dẫn" };
const offeringTypeLabels: Record<string, string> = { software: "Sản phẩm", solution: "Giải pháp", service: "Dịch vụ" };

function contentWarnings(label: string, href: string, { missingSeo, pending, scheduled }: ContentStats): WorkItem[] {
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

  const [analytics, readiness, content] = await Promise.all([getAnalyticsOverview(), getPublishingReadiness(), getDashboardContentSummary()]);
  const contentSummary = [
    { label: "Trang website", value: content.pages.total, detail: `${content.pages.published} trang đã xuất bản`, href: "/admin/pages", icon: FileText },
    { label: "Bài viết & Tin tức", value: content.posts.total, detail: `${content.posts.published} bài đã xuất bản`, href: "/admin/tin-tuc", icon: PenLine },
    { label: "Sản phẩm", value: content.offerings.products.total, detail: `${content.offerings.products.published} sản phẩm đã xuất bản`, href: "/admin/san-pham", icon: PackagePlus },
    { label: "Giải pháp", value: content.offerings.solutions.total, detail: `${content.offerings.solutions.published} giải pháp đã xuất bản`, href: "/admin/giai-phap", icon: LayoutTemplate },
    { label: "Dịch vụ", value: content.offerings.services.total, detail: `${content.offerings.services.published} dịch vụ đã xuất bản`, href: "/admin/dich-vu", icon: Settings2 },
    { label: "Thiết bị", value: content.equipment.total, detail: `${content.equipment.published} thiết bị đã xuất bản`, href: "/admin/thiet-bi", icon: PackagePlus },
    { label: "Tài nguyên", value: content.downloads.total, detail: `${content.downloads.enabled} tệp đang hiển thị`, href: "/admin/tai-nguyen", icon: Image },
    { label: "Khách hàng tiềm năng", value: content.leads.total, detail: `${content.leads.new} liên hệ mới cần xử lý`, href: "/admin/khach-hang-tiem-nang", icon: FileText },
  ];
  const quickActions = [
    { href: "/admin/pages/new", label: "Tạo trang mới", icon: FileText },
    { href: "/admin/tin-tuc/moi", label: "Viết bài viết", icon: PenLine },
    { href: "/admin/san-pham/moi", label: "Thêm sản phẩm", icon: PackagePlus },
    { href: "/admin/media", label: "Tải lên media", icon: Image },
  ];
  const contentForRecent: DashboardContent[] = content.recent.map((item) => ({
    ...item,
    type: item.kind === "page" ? "Trang website" : item.kind === "post" ? postTypeLabels[item.type] ?? "Bài viết" : item.kind === "offering" ? offeringTypeLabels[item.type] ?? "Nội dung catalog" : "Thiết bị",
    href: item.kind === "page" ? `/admin/pages/${item.id}` : item.kind === "post" ? `/admin/tin-tuc/${item.id}` : item.kind === "offering" ? `${offeringManagerHref(item.type)}/${item.id}` : `/admin/thiet-bi/${item.id}`,
  }));
  const workItems = [
    ...contentWarnings("Trang website", "/admin/pages", content.pages),
    ...contentWarnings("Bài viết & Tin tức", "/admin/tin-tuc", content.posts),
    ...contentWarnings("Sản phẩm", "/admin/san-pham", content.offerings.products),
    ...contentWarnings("Giải pháp", "/admin/giai-phap", content.offerings.solutions),
    ...contentWarnings("Dịch vụ", "/admin/dich-vu", content.offerings.services),
    ...contentWarnings("Thiết bị", "/admin/thiet-bi", content.equipment),
    ...readiness.filter((item) => item.status === "attention").map((item) => ({ label: item.label, detail: item.detail, href: item.href })),
  ].slice(0, 6);
  const readyChecks = readiness.filter((item) => item.status === "ready").length;

  return <div className="admin-dashboard admin-dashboard--overview">
    <AdminCard className="admin-dashboard__hero"><div><p>Chào mừng trở lại,</p><h1>{administrator.fullName} <span aria-hidden="true">👋</span></h1><small>Quản lý nội dung và theo dõi tình trạng website từ một nơi.</small></div><div className="admin-dashboard__hero-actions"><Link className="admin-dashboard__period" href="/admin/analytics"><CalendarDays aria-hidden="true" size={16} />Dữ liệu {analytics.periodDays} ngày</Link><Link className="admin-dashboard__hero-primary" href="/admin/pages/new"><Plus aria-hidden="true" size={16} />Tạo nội dung</Link></div></AdminCard>
    <div className="admin-dashboard__layout"><div className="admin-dashboard__primary">
      <section aria-label="Tóm tắt truy cập" className="admin-dashboard__traffic-metrics">{[["Lượt truy cập", analytics.visits], ["Người dùng mới", null], ["Số trang xem", null], ["Thời gian trung bình", null]].map(([label, value]) => <AdminCard className="admin-dashboard__traffic-metric" key={String(label)}><BarChart3 aria-hidden="true" size={19} /><div><span>{label}</span><strong>{value ?? "—"}</strong><small>Chưa kết nối dữ liệu</small></div></AdminCard>)}</section>
      <section className="admin-dashboard__analytics-grid" aria-label="Dữ liệu truy cập"><AdminCard className="admin-dashboard__analytics-panel admin-dashboard__analytics-panel--chart"><header><h2>Lượt truy cập website</h2><Link href="/admin/analytics">Xem thống kê →</Link></header><div className="admin-dashboard__analytics-empty"><BarChart3 aria-hidden="true" size={28} /><strong>Chưa có dữ liệu truy cập</strong><span>Khi kết nối nguồn thống kê, biểu đồ 7 ngày sẽ hiển thị tại đây.</span></div></AdminCard><AdminCard className="admin-dashboard__analytics-panel"><header><h2>Nguồn truy cập</h2></header><div className="admin-dashboard__analytics-empty"><span>Chưa có nguồn dữ liệu</span></div></AdminCard></section>
      <AdminCard className="admin-dashboard__content-summary"><header><h2>Tổng quan nội dung</h2><Link href="/admin/pages">Xem nội dung →</Link></header><div>{contentSummary.map((item) => { const Icon = item.icon; return <Link href={item.href} key={item.label}><span><Icon aria-hidden="true" size={19} /></span><b>{item.value}</b><strong>{item.label}</strong><small>{item.detail}</small></Link>; })}</div></AdminCard>
      <AdminCard className="admin-dashboard__recent"><header><div><h2>Nội dung gần đây</h2><p>Các nội dung được cập nhật mới nhất trong CMS.</p></div><Link className="admin-dashboard__create-link" href="/admin/pages/new"><Plus aria-hidden="true" size={15} />Tạo mới</Link></header><DashboardRecentTable items={contentForRecent} /></AdminCard>
    </div><aside className="admin-dashboard__aside"><AdminCard className="admin-dashboard__quick"><h2>Thao tác nhanh</h2><div>{quickActions.map((action) => { const Icon = action.icon; return <Link href={action.href} key={action.label}><span><Icon aria-hidden="true" size={21} /></span><strong>{action.label}</strong></Link>; })}</div></AdminCard><AdminCard className="admin-dashboard__readiness"><header><div><h2>Tình trạng xuất bản</h2><p>{readyChecks}/{readiness.length} kiểm tra sẵn sàng</p></div><Link href="/admin/seo/kiem-tra-xuat-ban">Chi tiết →</Link></header><div>{readiness.slice(0, 4).map((item) => <Link href={item.href} key={item.id}><i className={item.status === "ready" ? "admin-status admin-status--ready" : "admin-status"} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>)}</div></AdminCard><AdminCard className="admin-dashboard__work"><header><div><h2>Công việc cần chú ý</h2><p>Chỉ hiển thị dữ liệu cần xử lý.</p></div><Link href="/admin/seo/kiem-tra-xuat-ban">Xem tất cả →</Link></header>{workItems.length ? <div>{workItems.map((item) => <Link href={item.href} key={`${item.label}-${item.detail}`}><i className="admin-status" /><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>)}</div> : <p className="admin-dashboard__empty">Chưa có công việc cần xử lý.</p>}</AdminCard></aside></div>
  </div>;
}
