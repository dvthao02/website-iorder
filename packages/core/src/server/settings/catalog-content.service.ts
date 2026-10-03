import { eq } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, siteSettings } from "@iorder/core/db/schema";
import { catalogContentSchema } from "./catalog-content.contract";

const settingKey = "catalog_content";
export async function getCatalogContent() { const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, settingKey)).limit(1); return row ? catalogContentSchema.parse(row.value) : null; }
export async function updateCatalogContent(input: unknown, userId: string) { const values = catalogContentSchema.parse(input); await getDb().transaction(async tx => { const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, settingKey)).for("update"); const [after] = await tx.insert(siteSettings).values({ key: settingKey, value: values, description: "Nội dung trang danh mục Offering", updatedBy: userId }).onConflictDoUpdate({ target: siteSettings.key, set: { value: values, description: "Nội dung trang danh mục Offering", updatedBy: userId, updatedAt: new Date() } }).returning(); await tx.insert(auditLogs).values({ userId, action: "catalog_content.update", entityType: "site_setting", entityId: after.id, beforeData: before?.value ?? null, afterData: values }); }); return values; }
