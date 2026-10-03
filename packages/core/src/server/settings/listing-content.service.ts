import { eq } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, siteSettings } from "@iorder/core/db/schema";
import { listingContentSchema } from "./listing-content.contract";
const key = "listing_content";
export async function getListingContent() { const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1); return row ? listingContentSchema.parse(row.value) : null; }
export async function updateListingContent(input: unknown, userId: string) { const value = listingContentSchema.parse(input); await getDb().transaction(async tx => { const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, key)).for("update"); const [after] = await tx.insert(siteSettings).values({ key, value, description: "Nội dung trang listing public", updatedBy: userId }).onConflictDoUpdate({ target: siteSettings.key, set: { value, description: "Nội dung trang listing public", updatedBy: userId, updatedAt: new Date() } }).returning(); await tx.insert(auditLogs).values({ userId, action: "listing_content.update", entityType: "site_setting", entityId: after.id, beforeData: before?.value ?? null, afterData: value }); }); return value; }
