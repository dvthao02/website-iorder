import { cookies } from "next/headers";
import Link from "next/link";
import { CalendarDays, FileText, Image, PackagePlus, PenLine, Plus } from "lucide-react";

import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminPageBarActions, AdminPageBarMeta } from "@/components/admin/ui/admin-page-bar";
import { BackupStatusCard } from "@/components/admin/backup-status-card";
import { DashboardRecentTable } from "@/components/admin/dashboard-recent-table";
import { AnalyticsMetricTiles, AnalyticsTrafficPanel, TopPagesList } from "@/components/admin/analytics-status";
import { hasCmsPermission, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { administratorSessionCookieName, getAnalyticsOverview, getBackupStatus, getCurrentAdministrator, getDashboardContentSummary, getPublishingReadiness } from "@/lib/backend";

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
  if (type === "software") return "/admin/products";
  if (type === "solution") return "/admin/solutions";
  return "/admin/services";
}

export default async function AdministratorHomePage() {
  const cookieStore = await cookies();
  const administrator = await getCurrentAdministrator(cookieStore.get(administratorSessionCookieName)?.value);
  if (!administrator) return null;

  const [analytics, readiness, content, backup] = await Promise.all([getAnalyticsOverview(), getPublishingReadiness(), getDashboardContentSummary(), getBackupStatus()]);
  const can = (permission: CmsPermissionCode) => hasCmsPermission(administrator, permission);
  const contentSummary = ([
    { label: "Trang website", value: content.pages.total, detail: `${content.pages.published} trang đã xuất bản`, href: "/admin/pages", permission: "pages.view" },
    { label: "Bài viết & Tin tức", value: content.posts.total, detail: `${content.posts.published} bài đã xuất bản`, href: "/admin/news", permission: "posts.view" },
    { label: "Sản phẩm", value: content.offerings.products.total, detail: `${content.offerings.products.published} sản phẩm đã xuất bản`, href: "/admin/products?type=software", permission: "offerings.view" },
    { label: "Giải pháp", value: content.offerings.solutions.total, detail: `${content.offerings.solutions.published} giải pháp đã xuất bản`, href: "/admin/products?type=solution", permission: "offerings.view" },
    { label: "Dịch vụ", value: content.offerings.services.total, detail: `${content.offerings.services.published} dịch vụ đã xuất bản`, href: "/admin/products?type=service", permission: "offerings.view" },
    { label: "Thiết bị", value: content.equipment.total, detail: `${content.equipment.published} thiết bị đã xuất bản`, href: "/admin/equipment", permission: "equipment.view" },
    { label: "Tệp cài đặt", value: content.downloads.total, detail: `${content.downloads.enabled} tệp đang hiển thị`, href: "/admin/resources", permission: "support_downloads.view" },
    { label: "Khách hàng tiềm năng", value: content.leads.total, detail: `${content.leads.new} liên hệ mới cần xử lý`, href: "/admin/leads", permission: "leads.view" },
  ] satisfies Array<{ permission: CmsPermissionCode } & Record<string, unknown>>).filter((item) => can(item.permission));
  const quickActions = ([
    { href: "/admin/pages/new", label: "Tạo trang mới", icon: FileText, permission: "pages.create" },
    { href: "/admin/news/new", label: "Viết bài viết", icon: PenLine, permission: "posts.create" },
    { href: "/admin/products/new", label: "Thêm sản phẩm", icon: PackagePlus, permission: "offerings.create" },
    { href: "/admin/media", label: "Tải lên media", icon: Image, permission: "media.create" },
  ] satisfies Array<{ permission: CmsPermissionCode } & Record<string, unknown>>).filter((item) => can(item.permission));
  const contentForRecent: DashboardContent[] = content.recent.map((item) => ({
    ...item,
    type: item.kind === "page" ? "Trang" : item.kind === "post" ? postTypeLabels[item.type] ?? "Bài viết" : item.kind === "offering" ? offeringTypeLabels[item.type] ?? "Nội dung catalog" : "Thiết bị",
    href: item.kind === "page" ? `/admin/pages/${item.id}` : item.kind === "post" ? `/admin/news/${item.id}` : item.kind === "offering" ? `${offeringManagerHref(item.type)}/${item.id}` : `/admin/equipment/${item.id}`,
  }));
  const workItems = [
    ...contentWarnings("Trang website", "/admin/pages", content.pages),
    ...contentWarnings("Bài viết & Tin tức", "/admin/news", content.posts),
    ...contentWarnings("Sản phẩm", "/admin/products?type=software", content.offerings.products),
    ...contentWarnings("Giải pháp", "/admin/products?type=solution", content.offerings.solutions),
    ...contentWarnings("Dịch vụ", "/admin/products?type=service", content.offerings.services),
    ...contentWarnings("Thiết bị", "/admin/equipment", content.equipment),
    ...readiness.filter((item) => item.status === "attention").map((item) => ({ label: item.label, detail: item.detail, href: item.href })),
  ].slice(0, 6);
  const readyChecks = readiness.filter((item) => item.status === "ready").length;
  const canViewAnalytics = can("dashboard.view");

  return <div className="admin-page">
    <h1 className="sr-only">Bảng điều khiển</h1>
    <AdminPageBarMeta>Xin chào {administrator.fullName}</AdminPageBarMeta>
    <AdminPageBarActions>
      {canViewAnalytics ? <AdminButton href="/admin/analytics" leadingIcon={<CalendarDays aria-hidden="true" />} variant="secondary">Thống kê {analytics.periodDays} ngày</AdminButton> : null}
    </AdminPageBarActions>
    <div className="admin-dashboard__layout">
      <div className="admin-dashboard__primary">
        {/* Người không có quyền xem thống kê không thấy khối này (trước đây hiện nhầm "chưa kết nối"). */}
        {/* Chưa kết nối/lỗi: một dòng báo gọn thay cho 4 ô "—" và khung biểu đồ rỗng chiếm nửa màn hình. */}
        {canViewAnalytics ? analytics.connection === "connected" ? <>
          <AnalyticsMetricTiles overview={analytics} />
          <section aria-label="Dữ liệu truy cập" className="admin-dashboard__analytics-grid">
            <AdminCard><header><h2>Lượt xem trang</h2><Link href="/admin/analytics">Xem thống kê</Link></header><AnalyticsTrafficPanel overview={analytics} /></AdminCard>
            <AdminCard><header><h2>Trang xem nhiều nhất</h2></header><TopPagesList pages={analytics.topPages.slice(0, 5)} /></AdminCard>
          </section>
        </> : <AdminCard className="admin-dashboard__analytics-off"><AnalyticsTrafficPanel overview={analytics} /></AdminCard> : null}
        <AdminCard><header><h2>Nội dung</h2></header><div className="admin-dashboard__counts">{contentSummary.map((item) => <Link href={item.href} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></Link>)}</div></AdminCard>
        <AdminCard className="admin-dashboard__recent"><header><h2>Cập nhật gần đây</h2>{can("pages.create") ? <AdminButton href="/admin/pages/new" leadingIcon={<Plus aria-hidden="true" />} size="sm" variant="secondary">Tạo mới</AdminButton> : null}</header><DashboardRecentTable items={contentForRecent} /></AdminCard>
      </div>
      <aside className="admin-dashboard__aside">
        {quickActions.length ? <AdminCard><header><h2>Tạo nhanh</h2></header><div className="admin-dashboard__list">{quickActions.map((action) => { const Icon = action.icon; return <Link href={action.href} key={action.label}><Icon aria-hidden="true" size={16} /><strong>{action.label}</strong></Link>; })}</div></AdminCard> : null}
        <AdminCard><header><div><h2>Sẵn sàng xuất bản</h2><p>{readyChecks}/{readiness.length} mục đạt</p></div><Link href="/admin/seo/publish-check">Chi tiết</Link></header><div className="admin-dashboard__list">{readiness.slice(0, 4).map((item) => <Link href={item.href} key={item.id}><i className={item.status === "ready" ? "admin-status admin-status--ready" : "admin-status"} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>)}</div></AdminCard>
        {backup ? <BackupStatusCard detailsHref="/admin/backup" status={backup} /> : null}
        <AdminCard><header><h2>Cần xử lý</h2></header>{workItems.length ? <div className="admin-dashboard__list">{workItems.map((item) => <Link href={item.href} key={`${item.label}-${item.detail}`}><i className="admin-status" /><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>)}</div> : <p className="admin-dashboard__empty">Không có việc tồn đọng.</p>}</AdminCard>
      </aside>
    </div>
  </div>;
}
