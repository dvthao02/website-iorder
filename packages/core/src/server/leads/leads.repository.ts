import { and, asc, count, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, contactLeads } from "@iorder/core/db/schema";
import type { LeadExportQuery, LeadListQuery, LeadStatus, PublicLeadInput } from "./leads.contract";
import { toAdminListPage } from "../shared/admin-list.contract";

const leadListFields = { id: contactLeads.id, name: contactLeads.name, phone: contactLeads.phone, email: contactLeads.email, businessModel: contactLeads.businessModel, branches: contactLeads.branches, need: contactLeads.need, message: contactLeads.message, status: contactLeads.status, createdAt: contactLeads.createdAt, handledAt: contactLeads.handledAt };

function leadSearch(query: string | undefined) {
  const keyword = query ? `%${query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  return keyword ? or(ilike(contactLeads.name, keyword), ilike(contactLeads.phone, keyword), ilike(contactLeads.email, keyword), ilike(contactLeads.businessModel, keyword), ilike(contactLeads.need, keyword)) : undefined;
}

export async function listLeadsPage(query: LeadListQuery, database = getDb()) {
  const search = leadSearch(query.query);
  // Một snapshot cho hàng, tổng và bộ đếm; không để chúng lệch khi có mutation đồng thời.
  return database.transaction(async tx => {
    const condition = and(search, query.status === "all" ? undefined : eq(contactLeads.status, query.status));
    const items = await tx.select(leadListFields).from(contactLeads).where(condition)
      .orderBy(desc(contactLeads.createdAt), asc(contactLeads.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const counts = { all: 0, new: 0, contacted: 0, closed: 0 };
    const totals = await tx.select({ status: contactLeads.status, total: count() }).from(contactLeads).where(search).groupBy(contactLeads.status);
    for (const row of totals) { counts[row.status] = row.total; counts.all += row.total; }
    return { ...toAdminListPage(items, query, counts[query.status]), counts };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function createRateLimitedLead(values: PublicLeadInput, ipHash: string | null, since: Date, database = getDb()) {
  return database.transaction(async (tx) => {
    if (ipHash) {
      // Serialize only matching IP hashes for this short transaction, preventing
      // concurrent requests from both passing the read-then-insert rate check.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${ipHash}, 0::bigint))`);
      const [recent] = await tx.select({ id: contactLeads.id }).from(contactLeads)
        .where(and(eq(contactLeads.ipHash, ipHash), gte(contactLeads.createdAt, since))).limit(1);
      if (recent) return undefined;
    }

    const [lead] = await tx.insert(contactLeads).values({ ...values, ipHash }).returning({ id: contactLeads.id });
    return lead;
  });
}

export function updateLeadStatus(id: string, status: LeadStatus, userId: string, database = getDb()) {
  return database.transaction(async (tx) => {
    const [before] = await tx.select().from(contactLeads).where(eq(contactLeads.id, id)).for("update");
    if (!before) return undefined;
    if (before.status === status) return before;
    const handled = status !== "new";
    const [after] = await tx.update(contactLeads).set({ status, handledAt: handled ? new Date() : null, handledBy: handled ? userId : null }).where(eq(contactLeads.id, id)).returning();
    await tx.insert(auditLogs).values({ userId, action: "lead.status_update", entityType: "contact_lead", entityId: id, beforeData: { status: before.status }, afterData: { status: after.status } });
    return after;
  });
}

// Xuất theo đúng bộ lọc đang xem; ghi nhật ký vì đây là dữ liệu cá nhân của khách hàng.
export async function listLeadsForExport(query: LeadExportQuery, actorId: string, limit: number, database = getDb()) {
  return database.transaction(async tx => {
    const rows = await tx.select(leadListFields).from(contactLeads)
      .where(and(leadSearch(query.query), query.status === "all" ? undefined : eq(contactLeads.status, query.status)))
      .orderBy(desc(contactLeads.createdAt), asc(contactLeads.id)).limit(limit);
    await tx.insert(auditLogs).values({ userId: actorId, action: "lead.export", entityType: "contact_lead", entityId: null, beforeData: null, afterData: { status: query.status, query: query.query ?? null, rows: rows.length } });
    return rows;
  });
}
