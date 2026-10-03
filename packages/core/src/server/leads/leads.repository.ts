import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, contactLeads } from "@iorder/core/db/schema";
import type { LeadStatus, PublicLeadInput } from "./leads.contract";

export function findRecentLeadByIpHash(ipHash: string, since: Date) {
  return getDb().select({ id: contactLeads.id }).from(contactLeads).where(and(eq(contactLeads.ipHash, ipHash), gte(contactLeads.createdAt, since))).limit(1);
}

export function createLead(values: PublicLeadInput, ipHash: string | null) {
  return getDb().insert(contactLeads).values({ ...values, ipHash }).returning({ id: contactLeads.id });
}

export function listLeads() {
  return getDb().select({ id: contactLeads.id, name: contactLeads.name, phone: contactLeads.phone, email: contactLeads.email, businessModel: contactLeads.businessModel, branches: contactLeads.branches, need: contactLeads.need, message: contactLeads.message, status: contactLeads.status, createdAt: contactLeads.createdAt, handledAt: contactLeads.handledAt }).from(contactLeads).orderBy(desc(contactLeads.createdAt));
}

export function updateLeadStatus(id: string, status: LeadStatus, userId: string) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(contactLeads).where(eq(contactLeads.id, id)).for("update");
    if (!before) return undefined;
    const handled = status !== "new";
    const [after] = await tx.update(contactLeads).set({ status, handledAt: handled ? new Date() : null, handledBy: handled ? userId : null }).where(eq(contactLeads.id, id)).returning();
    await tx.insert(auditLogs).values({ userId, action: "lead.status_update", entityType: "contact_lead", entityId: id, beforeData: { status: before.status }, afterData: { status: after.status } });
    return after;
  });
}
