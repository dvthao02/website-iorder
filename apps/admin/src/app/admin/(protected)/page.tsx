import { cookies } from "next/headers";
import Link from "next/link";
import { FileText, Image, PackagePlus, PenLine, Plus } from "lucide-react";

import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminPage } from "@/components/admin/ui/admin-page";
import { AdminPageBarActions, AdminPageBarMeta } from "@/components/admin/ui/admin-page-bar";
import { BackupStatusCard } from "@/components/admin/backup-status-card";
import { SearchConsoleCard } from "@/components/admin/search-console-card";
import { editorHref as seoEditorHref, issueLabels as seoIssueLabels } from "@/components/admin/seo-audit-panel";
import { DashboardRecentTable } from "@/components/admin/dashboard-recent-table";
import { DayBars, KpiTile, RingGauge, SegmentLegend, Sparkline, StackedRow, type ChartTone } from "@/components/admin/dashboard-charts";
import { DashboardRangeFilter } from "@/components/admin/dashboard-range-filter";
import { parseDashboardRange } from "@iorder/shared/server/dashboard/dashboard-range";
import { contentSegments, seoAverageScore, sumDays } from "@/lib/dashboard-metrics";
import { AnalyticsMetricTiles, AnalyticsTrafficPanel, TopPagesList } from "@/components/admin/analytics-status";
import { hasCmsPermission, type CmsPermissionCode } from "@iorder/shared/server/auth/permissions";
import { administratorSessionCookieName, getAnalyticsOverview, getBackupStatus, getCurrentAdministrator, getDashboardContentSummary, getPublishingReadiness, getSeoAudit } from "@/lib/backend";

type ContentStatus = "draft" | "review" | "scheduled" | "published" | "archived";
type DashboardContent = { id: string; title: string; type: string; status: ContentStatus; updatedAt: Date; href: string };
type WorkItem = { label: string; detail: string; href: string };
type ContentStats = { pending: number; scheduled: number };

const postTypeLabels: Record<string, string> = { news: "Tin tức", promotion: "Khuyến mãi", case_study: "Câu chuyện khách hàng", announcement: "Thông báo", guide: "Hướng dẫn" };
const offeringTypeLabels: Record<string, string> = { software: "Sản phẩm", solution: "Giải pháp" };

// "Cần xử lý" chỉ gồm việc nội dung đang chờ (nháp, chờ duyệt, hẹn giờ). Thiếu SEO đã có thẻ "Việc SEO nên làm" và mục chưa sẵn sàng xuất bản đã có thẻ "Sẵn sàng xuất bản", nên không lặp lại ở đây.
function contentWarnings(label: string, href: string, { pending, scheduled }: ContentStats): WorkItem[] {
  return [
    ...(pending ? [{ label: `${label}: nội dung chưa xuất bản`, detail: `${pending} mục đang là bản nháp hoặc chờ duyệt.`, href }] : []),
    ...(scheduled ? [{ label: `${label}: nội dung hẹn giờ`, detail: `${scheduled} mục đang chờ thời điểm xuất bản.`, href }] : []),
  ];
}

function offeringManagerHref(type: string) {
  if (type === "software") return "/admin/products";
  return "/admin/solutions";
}

export default async function AdministratorHomePage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  const { range } = await searchParams;
  // Khoảng thời gian của bộ lọc thống kê (7 / 30 / 90 ngày) áp cho ô chỉ số, biểu đồ và số liệu truy cập.
  const days = parseDashboardRange(Array.isArray(range) ? range[0] : range);
  const cookieStore = await cookies();
  const administrator = await getCurrentAdministrator(cookieStore.get(administratorSessionCookieName)?.value);
  if (!administrator) return null;

  // Kiểm tra SEO là phần phụ của Tổng quan: không có quyền xem (null) hoặc lỗi thì ẩn thẻ, không làm hỏng cả trang.
  const [analytics, readiness, content, backup, seoAudit] = await Promise.all([getAnalyticsOverview(days), getPublishingReadiness(days), getDashboardContentSummary(days), getBackupStatus(days), getSeoAudit().catch(() => null)]);
  const can = (permission: CmsPermissionCode) => hasCmsPermission(administrator, permission);
  // Cơ cấu nội dung theo trạng thái: mỗi loại một thanh xếp chồng (đã xuất bản / nháp / hẹn giờ / lưu trữ), chỉ hiện loại người xem có quyền.
  const contentRows = ([
    { label: "Trang website", stat: content.pages, href: "/admin/pages", permission: "pages.view" },
    { label: "Bài viết & Tin tức", stat: content.posts, href: "/admin/news", permission: "posts.view" },
    { label: "Sản phẩm", stat: content.offerings.products, href: "/admin/products?type=software", permission: "offerings.view" },
    { label: "Giải pháp", stat: content.offerings.solutions, href: "/admin/products?type=solution", permission: "offerings.view" },
    { label: "Thiết bị", stat: content.equipment, href: "/admin/equipment", permission: "equipment.view" },
  ] satisfies Array<{ permission: CmsPermissionCode } & Record<string, unknown>>).filter((item) => can(item.permission));
  const downloadsRow = can("support_downloads.view") ? { label: "Tệp cài đặt", href: "/admin/resources", segments: contentSegments({ total: content.downloads.total, published: content.downloads.enabled, pending: 0, scheduled: 0 }) } : null;
  const publishedTotal = contentRows.reduce((sum, row) => sum + row.stat.published, 0);
  const contentTotal = contentRows.reduce((sum, row) => sum + row.stat.total, 0);
  const seoScore = seoAudit ? seoAverageScore(seoAudit) : null;
  const canViewLeads = can("leads.view");
  const leadsLast30 = sumDays(content.leadsDaily);
  const toneOf = (share: number): ChartTone => share >= 0.85 ? "success" : share >= 0.6 ? "primary" : "warning";
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
    ...contentWarnings("Thiết bị", "/admin/equipment", content.equipment),
  ].slice(0, 6);
  const readyChecks = readiness.filter((item) => item.status === "ready").length;
  // Thẻ ghi "13/14 mục đạt" thì mục chưa đạt phải hiện trước, không bị 4 mục đạt đầu danh sách che mất (sort ổn định: giữ thứ tự gốc trong từng nhóm).
  const readinessPreview = [...readiness].sort((a, b) => Number(a.status === "ready") - Number(b.status === "ready")).slice(0, 4);
  const canViewAnalytics = can("dashboard.view");

  return <AdminPage>
    <h1 className="sr-only">Bảng điều khiển</h1>
    <AdminPageBarMeta>Xin chào {administrator.fullName}</AdminPageBarMeta>
    <AdminPageBarActions>
      <DashboardRangeFilter value={days} />
    </AdminPageBarActions>
    <div className="admin-dashboard__layout">
      <div className="admin-dashboard__primary">
        <section aria-label="Chỉ số chính" className="admin-kpi-grid">
          {canViewLeads ? <KpiTile href="/admin/leads" label={`Khách liên hệ (${days} ngày)`} note={content.leads.new ? `${content.leads.new} liên hệ mới chưa xử lý` : "Không có liên hệ chờ xử lý"} value={String(leadsLast30)} visual={<Sparkline label={`Khách liên hệ theo ngày, tổng ${leadsLast30}`} points={content.leadsDaily} tone="primary" unit="liên hệ" />} /> : null}
          {contentTotal ? <KpiTile href="/admin/pages" label="Nội dung đã xuất bản" note={`trên tổng ${contentTotal} mục`} value={String(publishedTotal)} visual={<RingGauge label={`${publishedTotal} trên ${contentTotal} nội dung đã xuất bản`} max={contentTotal} tip={[`Đã xuất bản: ${publishedTotal}/${contentTotal} mục`, ...contentRows.map((row) => `${row.label}: ${row.stat.published}/${row.stat.total}`)].join("\n")} tone="success" value={publishedTotal} />} /> : null}
          {seoScore !== null ? <KpiTile href="/admin/seo/publish-check" label="Điểm SEO trung bình" note={seoAudit && seoAudit.rows.length ? `${seoAudit.rows.length} nội dung cần xem lại` : "Mọi nội dung đều ổn"} value={`${seoScore}/100`} visual={<RingGauge label={`Điểm SEO trung bình ${seoScore} trên 100`} max={100} tip={seoAudit ? `Điểm SEO trung bình: ${seoScore}/100\n${seoAudit.checked} nội dung được chấm\n${seoAudit.healthy.length} ổn · ${seoAudit.rows.length} cần xem lại` : undefined} tone={toneOf(seoScore / 100)} value={seoScore} />} /> : null}
          {readiness.length ? <KpiTile href="/admin/seo/publish-check" label="Sẵn sàng xuất bản" note={readyChecks === readiness.length ? "Mọi mục đã đạt" : `${readiness.length - readyChecks} mục cần xử lý`} value={`${readyChecks}/${readiness.length}`} visual={<RingGauge label={`${readyChecks} trên ${readiness.length} mục sẵn sàng xuất bản`} max={readiness.length} tip={[`Sẵn sàng xuất bản: ${readyChecks}/${readiness.length} mục đạt`, ...readiness.filter((item) => item.status !== "ready").slice(0, 4).map((item) => `Chưa đạt: ${item.label}`)].join("\n")} tone={toneOf(readyChecks / readiness.length)} value={readyChecks} />} /> : null}
        </section>
        {/* Người không có quyền xem thống kê không thấy khối này (trước đây hiện nhầm "chưa kết nối"). */}
        {/* Chưa kết nối/lỗi: một dòng báo gọn thay cho 4 ô "—" và khung biểu đồ rỗng chiếm nửa màn hình. */}
        {canViewAnalytics ? analytics.connection === "connected" ? <>
          <AnalyticsMetricTiles overview={analytics} />
          <section aria-label="Dữ liệu truy cập" className="admin-dashboard__analytics-grid">
            <AdminCard><header><h2>Lượt xem trang</h2><Link href="/admin/analytics">Xem thống kê</Link></header><AnalyticsTrafficPanel overview={analytics} /></AdminCard>
            <AdminCard><header><h2>Trang xem nhiều nhất</h2></header><TopPagesList days={analytics.periodDays} pages={analytics.topPages.slice(0, 5)} /></AdminCard>
          </section>
        </> : <AdminCard className="admin-dashboard__analytics-off"><AnalyticsTrafficPanel overview={analytics} /></AdminCard> : null}
        {canViewLeads || contentRows.length ? <section aria-label={`Hoạt động ${days} ngày`} className="admin-dashboard__charts">
          {canViewLeads ? <AdminCard><header><div><h2>Khách liên hệ</h2><p>{days} ngày gần đây</p></div><Link href="/admin/leads">Xem danh sách</Link></header><DayBars days={content.leadsDaily} emptyText="Chưa có khách liên hệ nào trong 30 ngày qua." tone="primary" unit="liên hệ" /></AdminCard> : null}
          {contentRows.length ? <AdminCard><header><div><h2>Nội dung được chỉnh sửa</h2><p>{days} ngày gần đây</p></div></header><DayBars days={content.activity} emptyText="Chưa có nội dung nào được chỉnh sửa trong 30 ngày qua." tone="info" unit="lượt chỉnh sửa" /></AdminCard> : null}
        </section> : null}
        {contentRows.length || downloadsRow ? <AdminCard><header><div><h2>Cơ cấu nội dung</h2><p>Theo trạng thái từng loại</p></div><SegmentLegend /></header><div className="admin-stack-list">{contentRows.map((row) => <StackedRow href={row.href} key={row.label} label={row.label} segments={contentSegments(row.stat)} />)}{downloadsRow ? <StackedRow href={downloadsRow.href} label={downloadsRow.label} segments={downloadsRow.segments} /> : null}</div></AdminCard> : null}
        <AdminCard className="admin-dashboard__recent"><header><h2>Cập nhật gần đây</h2>{can("pages.create") ? <AdminButton href="/admin/pages/new" leadingIcon={<Plus aria-hidden="true" />} size="sm" variant="secondary">Tạo mới</AdminButton> : null}</header><DashboardRecentTable items={contentForRecent} /></AdminCard>
      </div>
      <aside className="admin-dashboard__aside">
        {quickActions.length ? <AdminCard><header><h2>Tạo nhanh</h2></header><div className="admin-dashboard__list">{quickActions.map((action) => { const Icon = action.icon; return <Link href={action.href} key={action.label}><Icon aria-hidden="true" size={16} /><strong>{action.label}</strong></Link>; })}</div></AdminCard> : null}
        <AdminCard><header><div><h2>Sẵn sàng xuất bản</h2><p>{readyChecks}/{readiness.length} mục đạt</p></div><Link href="/admin/seo/publish-check">Chi tiết</Link></header><div className="admin-dashboard__list">{readinessPreview.map((item) => <Link href={item.href} key={item.id} title={item.detail}><i className={item.status === "ready" ? "admin-status admin-status--ready" : "admin-status"} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>)}</div></AdminCard>
        {seoAudit ? <AdminCard>
          <header><div><h2>Việc SEO nên làm</h2><p>{seoAudit.rows.length ? `${seoAudit.rows.length}/${seoAudit.checked} nội dung cần xem lại` : `${seoAudit.checked} nội dung đều ổn`}</p></div><Link href="/admin/seo/publish-check">Chi tiết</Link></header>
          {seoAudit.rows.length ? <div className="admin-dashboard__list">{seoAudit.rows.slice(0, 5).map((row) => <Link href={seoEditorHref(row)} key={`${row.kind}-${row.id}`} title={row.issues.map((issue) => issue.message).join(" ")}><i className="admin-status" /><span><strong>{row.label}</strong><small>{seoIssueLabels[row.issues[0].code]}{row.issues.length > 1 ? ` và ${row.issues.length - 1} việc khác` : ""}</small></span></Link>)}</div> : <p className="admin-dashboard__empty">SEO các nội dung đang hiển thị đều ổn.</p>}
        </AdminCard> : null}
        {/* Số liệu từ Google Search Console: tải sau khi trang mở (lần đầu phải hỏi Google); chưa nối thì thẻ nói rõ, không có quyền xem cài đặt thì không hiện. */}
        {can("settings.view") ? <SearchConsoleCard /> : null}
        {backup ? <BackupStatusCard detailsHref="/admin/backup" status={backup} /> : null}
        {workItems.length ? <AdminCard><header><h2>Cần xử lý</h2></header><div className="admin-dashboard__list">{workItems.map((item) => <Link href={item.href} key={`${item.label}-${item.detail}`} title={item.detail}><i className="admin-status" /><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>)}</div></AdminCard> : null}
      </aside>
    </div>
  </AdminPage>;
}
