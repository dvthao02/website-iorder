import { and, count, desc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { contactLeads, offerings, pages, posts, salesEquipment, supportDownloads } from "@iorder/core/db/schema";
import { hasCmsPermission, type CmsActor, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";

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
  downloads: { enabled: number; total: number };
  equipment: DashboardContentStat;
  leads: { new: number; total: number };
  offerings: { products: DashboardContentStat; services: DashboardContentStat; solutions: DashboardContentStat };
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

function emptyStat(): DashboardContentStat {
  return { missingSeo: 0, pending: 0, published: 0, scheduled: 0, total: 0 };
}

// Mỗi phần chỉ được tính khi người xem có quyền xem module tương ứng; phần còn lại trả 0.
export async function getDashboardContentSummary(actor: CmsActor): Promise<DashboardContentSummary> {
  const when = <T>(permission: CmsPermissionCode, query: () => Promise<T>, fallback: T) => hasCmsPermission(actor, permission) ? query() : Promise.resolve(fallback);
  const [pageStats, postStats, productStats, solutionStats, serviceStats, equipmentStats, downloadRows, leadRows, pageRecent, postRecent, offeringRecent, equipmentRecent] = await Promise.all([
    when("pages.view", () => contentStats(pages), emptyStat()),
    when("posts.view", () => contentStats(posts, ne(posts.type, "guide")), emptyStat()),
    when("offerings.view", () => contentStats(offerings, eq(offerings.type, "software")), emptyStat()),
    when("offerings.view", () => contentStats(offerings, eq(offerings.type, "solution")), emptyStat()),
    when("offerings.view", () => contentStats(offerings, eq(offerings.type, "service")), emptyStat()),
    when("equipment.view", () => contentStats(salesEquipment), emptyStat()),
    when("support_downloads.view", () => getDb().select({ total: count(), enabled: sql<number>`count(*) filter (where ${supportDownloads.isEnabled} = true and ${supportDownloads.archivedAt} is null)`.mapWith(Number) }).from(supportDownloads).where(isNull(supportDownloads.deletedAt)), []),
    when("leads.view", () => getDb().select({ total: count(), new: sql<number>`count(*) filter (where ${contactLeads.status} = 'new')`.mapWith(Number) }).from(contactLeads), []),
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
    offerings: { products: productStats, solutions: solutionStats, services: serviceStats },
    equipment: equipmentStats,
    downloads: downloadRows[0] ?? { enabled: 0, total: 0 },
    leads: leadRows[0] ?? { new: 0, total: 0 },
    recent,
  };
}
