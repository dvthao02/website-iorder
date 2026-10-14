import { and, asc, count, eq, ilike, isNull, or } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, mediaAssets, partners, testimonials } from "@iorder/core/db/schema";
import type { PartnerInput, PartnerListQuery, TestimonialInput, TestimonialListQuery } from "./supporting.contract";
import { toAdminListPage } from "../shared/admin-list.contract";

export async function listPartnersPage(query: PartnerListQuery, database = getDb()) {
  const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const condition = and(
    isNull(partners.deletedAt),
    query.visibility === "all" ? undefined : eq(partners.isEnabled, query.visibility === "enabled"),
    query.partnerKind === "all" ? undefined : eq(partners.kind, query.partnerKind),
    keyword ? or(ilike(partners.name, keyword), ilike(partners.description, keyword), ilike(partners.websiteUrl, keyword)) : undefined,
  );
  return database.transaction(async tx => {
    const items = await tx.select({ partner: partners, storageKey: mediaAssets.storageKey, altText: mediaAssets.altText })
      .from(partners).leftJoin(mediaAssets, eq(partners.logoMediaId, mediaAssets.id)).where(condition)
      .orderBy(asc(partners.sortOrder), asc(partners.name), asc(partners.id))
      .limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [totals] = await tx.select({ total: count() }).from(partners).where(condition);
    return toAdminListPage(items, query, totals.total);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function listTestimonialsPage(query: TestimonialListQuery, database = getDb()) {
  const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const condition = and(
    isNull(testimonials.deletedAt),
    query.visibility === "all" ? undefined : eq(testimonials.isEnabled, query.visibility === "enabled"),
    keyword ? or(ilike(testimonials.authorName, keyword), ilike(testimonials.authorRole, keyword), ilike(testimonials.company, keyword), ilike(testimonials.quote, keyword)) : undefined,
  );
  return database.transaction(async tx => {
    const items = await tx.select({ testimonial: testimonials, storageKey: mediaAssets.storageKey, altText: mediaAssets.altText })
      .from(testimonials).leftJoin(mediaAssets, eq(testimonials.avatarMediaId, mediaAssets.id)).where(condition)
      .orderBy(asc(testimonials.sortOrder), asc(testimonials.authorName), asc(testimonials.id))
      .limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [totals] = await tx.select({ total: count() }).from(testimonials).where(condition);
    return toAdminListPage(items, query, totals.total);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export function listPartners(enabledOnly = false) { return getDb().select({ partner: partners, storageKey: mediaAssets.storageKey, altText: mediaAssets.altText }).from(partners).leftJoin(mediaAssets, eq(partners.logoMediaId, mediaAssets.id)).where(and(isNull(partners.deletedAt), enabledOnly ? eq(partners.isEnabled, true) : undefined)).orderBy(asc(partners.sortOrder), asc(partners.name), asc(partners.id)); }
export function listTestimonials(enabledOnly = false) { return getDb().select({ testimonial: testimonials, storageKey: mediaAssets.storageKey, altText: mediaAssets.altText }).from(testimonials).leftJoin(mediaAssets, eq(testimonials.avatarMediaId, mediaAssets.id)).where(and(isNull(testimonials.deletedAt), enabledOnly ? eq(testimonials.isEnabled, true) : undefined)).orderBy(asc(testimonials.sortOrder), asc(testimonials.authorName), asc(testimonials.id)); }
export function savePartner(id: string | null, values: PartnerInput, userId: string, database = getDb()) { return database.transaction(async tx => { const [row] = id ? await tx.update(partners).set({ ...values, updatedAt: new Date() }).where(and(eq(partners.id, id), isNull(partners.deletedAt))).returning() : await tx.insert(partners).values(values).returning(); if (!row) return undefined; await tx.insert(auditLogs).values({ userId, action: id ? "partner.update" : "partner.create", entityType: "partner", entityId: row.id, afterData: values }); return row.id; }); }
export function saveTestimonial(id: string | null, values: TestimonialInput, userId: string, database = getDb()) { return database.transaction(async tx => { const [row] = id ? await tx.update(testimonials).set({ ...values, updatedAt: new Date() }).where(and(eq(testimonials.id, id), isNull(testimonials.deletedAt))).returning() : await tx.insert(testimonials).values(values).returning(); if (!row) return undefined; await tx.insert(auditLogs).values({ userId, action: id ? "testimonial.update" : "testimonial.create", entityType: "testimonial", entityId: row.id, afterData: values }); return row.id; }); }
export function deleteDisabledPartner(id: string, userId: string, database = getDb()) { return database.transaction(async tx => { const [before] = await tx.select().from(partners).where(and(eq(partners.id, id), eq(partners.isEnabled, false), isNull(partners.deletedAt))).for("update"); if (!before) return undefined; const [deleted] = await tx.update(partners).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(partners.id, id), isNull(partners.deletedAt))).returning({ id: partners.id }); if (!deleted) return undefined; await tx.insert(auditLogs).values({ userId, action: "partner.delete", entityType: "partner", entityId: deleted.id, beforeData: before }); return deleted.id; }); }
export function deleteDisabledTestimonial(id: string, userId: string, database = getDb()) { return database.transaction(async tx => { const [before] = await tx.select().from(testimonials).where(and(eq(testimonials.id, id), eq(testimonials.isEnabled, false), isNull(testimonials.deletedAt))).for("update"); if (!before) return undefined; const [deleted] = await tx.update(testimonials).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(testimonials.id, id), isNull(testimonials.deletedAt))).returning({ id: testimonials.id }); if (!deleted) return undefined; await tx.insert(auditLogs).values({ userId, action: "testimonial.delete", entityType: "testimonial", entityId: deleted.id, beforeData: before }); return deleted.id; }); }
