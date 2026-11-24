import { and, count, desc, eq, gte, isNull, ne, sql, type SQL } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { contactLeads, offerings, pages, posts, salesEquipment, supportDownloads } from "@iorder/shared/db/schema";
import { hasCmsPermission, type CmsActor, type CmsPermissionCode } from "@iorder/shared/server/auth/permissions";
import { dailySeriesStart, fillDailySeries, type DashboardDailyPoint } from "./daily-series";
import { defaultDashboardRange, type DashboardRange } from "./dashboard-range";

type ContentStatus = "draft" | "review" | "scheduled" | "published" | "archived";
type ContentTable = typeof pages | typeof posts | typeof offerings | typeof salesEquipment;

export type DashboardContentStat = {
  missingSeo: number;
  pending: number;
  published: number;
  scheduled: number;
  total: number;
};

export type DashboardRecentContent = {
  id: string;
  kind: "equipment" | "offering" | "page" | "post";
  status: ContentStatus;
  title: string;
  type: string;
  updatedAt: Date;
};

export type DashboardContentSummary = {
  /** Số nội dung được chỉnh sửa mỗi ngày (cập nhật gần nhất của từng mục) trong khoảng đã chọn, theo các module người xem có quyền. */
  activity: DashboardDailyPoint[];
  downloads: { enabled: number; total: number };
  equipment: DashboardContentStat;
  leads: { new: number; total: number };
  /** Số khách để lại liên hệ mỗi ngày trong khoảng đã chọn. */
  leadsDaily: DashboardDailyPoint[];
  offerings: { products: DashboardContentStat; solutions: DashboardContentStat };
  pages: DashboardContentStat;
  posts: DashboardContentStat;
  recent: DashboardRecentContent[];
};

async function contentStats(table: ContentTable, extraCondition?: SQL) {
  const [row] = await getDb().select({
    total: count(),
    published: sql<number>`count(*) filter (where ${table.status} = 'published')`.mapWith(Number),
    pending: sql<number>`count(*) filter (where ${table.status} in ('draft', 'review'))`.mapWith(Number),
    scheduled: sql<number>`count(*) filter (where ${table.status} = 'scheduled')`.mapWith(Number),
    missingSeo: sql<number>`count(*) filter (where ${table.status} = 'published' and (${table.seoTitle} is null or ${table.seoDescription} is null))`.mapWith(Number),
  }).from(table).where(and(isNull(table.deletedAt), extraCondition));
  return row ?? emptyStat();
}

// Số dòng theo ngày (giờ Việt Nam) của một cột thời gian, chỉ lấy từ mốc `since`.
async function dailyCounts(table: ContentTable | typeof contactLeads, column: ContentTable["updatedAt"] | typeof contactLeads.createdAt, since: Date, extraCondition?: SQL) {
  const day = sql<string>`to_char(timezone('Asia/Ho_Chi_Minh', ${column}), 'YYYY-MM-DD')`;
  return getDb().select({ date: day, count: count() }).from(table).where(and(gte(column, since), extraCondition)).groupBy(day);
}

function emptyStat(): DashboardContentStat {
  return { missingSeo: 0, pending: 0, published: 0, scheduled: 0, total: 0 };
}

// Mỗi phần chỉ được tính khi người xem có quyền xem module tương ứng; phần còn lại trả 0.
export async function getDashboardContentSummary(actor: CmsActor, now = new Date(), days: DashboardRange = defaultDashboardRange): Promise<DashboardContentSummary> {
  const since = dailySeriesStart(days, now);
  const when = <T>(permission: CmsPermissionCode, query: () => Promise<T>, fallback: T) => hasCmsPermission(actor, permission) ? query() : Promise.resolve(fallback);
  const [activityRows, leadDailyRows, pageStats, postStats, productStats, solutionStats, equipmentStats, downloadRows, leadRows, pageRecent, postRecent, offeringRecent, equipmentRecent] = await Promise.all([
    Promise.all([
      when("pages.view", () => dailyCounts(pages, pages.updatedAt, since, isNull(pages.deletedAt)), []),
      when("posts.view", () => dailyCounts(posts, posts.updatedAt, since, and(isNull(posts.deletedAt), ne(posts.type, "guide"))), []),
      when("offerings.view", () => dailyCounts(offerings, offerings.updatedAt, since, isNull(offerings.deletedAt)), []),
      when("equipment.view", () => dailyCounts(salesEquipment, salesEquipment.updatedAt, since, isNull(salesEquipment.deletedAt)), []),
    ]).then((groups) => groups.flat()),
    when("leads.view", () => dailyCounts(contactLeads, contactLeads.createdAt, since, isNull(contactLeads.deletedAt)), []),
    when("pages.view", () => contentStats(pages, ne(pages.slug, "home")), emptyStat()),
    when("posts.view", () => contentStats(posts, ne(posts.type, "guide")), emptyStat()),
    when("offerings.view", () => contentStats(offerings, eq(offerings.type, "software")), emptyStat()),
    when("offerings.view", () => contentStats(offerings, eq(offerings.type, "solution")), emptyStat()),
    when("equipment.view", () => contentStats(salesEquipment), emptyStat()),
    when("support_downloads.view", () => getDb().select({ total: count(), enabled: sql<number>`count(*) filter (where ${supportDownloads.isEnabled} = true and ${supportDownloads.archivedAt} is null)`.mapWith(Number) }).from(supportDownloads).where(isNull(supportDownloads.deletedAt)), []),
    when("leads.view", () => getDb().select({ total: count(), new: sql<number>`count(*) filter (where ${contactLeads.status} = 'new')`.mapWith(Number) }).from(contactLeads).where(isNull(contactLeads.deletedAt)), []),
    when("pages.view", () => getDb().select({ id: pages.id, title: pages.title, type: sql<string>`'page'`, status: pages.status, updatedAt: pages.updatedAt }).from(pages).where(isNull(pages.deletedAt)).orderBy(desc(pages.updatedAt)).limit(8), []),
    when("posts.view", () => getDb().select({ id: posts.id, title: posts.title, type: posts.type, status: posts.status, updatedAt: posts.updatedAt }).from(posts).where(and(isNull(posts.deletedAt), ne(posts.type, "guide"))).orderBy(desc(posts.updatedAt)).limit(8), []),
    when("offerings.view", () => getDb().select({ id: offerings.id, title: offerings.title, type: offerings.type, status: offerings.status, updatedAt: offerings.updatedAt }).from(offerings).where(isNull(offerings.deletedAt)).orderBy(desc(offerings.updatedAt)).limit(8), []),
    when("equipment.view", () => getDb().select({ id: salesEquipment.id, title: salesEquipment.name, type: sql<string>`'equipment'`, status: salesEquipment.status, updatedAt: salesEquipment.updatedAt }).from(salesEquipment).where(isNull(salesEquipment.deletedAt)).orderBy(desc(salesEquipment.updatedAt)).limit(8), []),
  ]);

  const recent = [
    ...pageRecent.map((item) => ({ ...item, kind: "page" as const })),
    ...postRecent.map((item) => ({ ...item, kind: "post" as const })),
    ...offeringRecent.map((item) => ({ ...item, kind: "offering" as const })),
    ...equipmentRecent.map((item) => ({ ...item, kind: "equipment" as const })),
  ].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()).slice(0, 8);

  return {
    pages: pageStats,
    posts: postStats,
    offerings: { products: productStats, solutions: solutionStats },
    equipment: equipmentStats,
    downloads: downloadRows[0] ?? { enabled: 0, total: 0 },
    leads: leadRows[0] ?? { new: 0, total: 0 },
    recent,
    activity: fillDailySeries(activityRows, days, now),
    leadsDaily: fillDailySeries(leadDailyRows, days, now),
  };
}
