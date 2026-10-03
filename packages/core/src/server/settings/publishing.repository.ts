import { eq } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, siteSettings } from "@iorder/core/db/schema";
import type { PublishingConfig } from "./publishing.contract";

const publishingKey = "publishing";
export async function findPublishingConfig() { const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, publishingKey)).limit(1); return row; }
export function savePublishingConfig(values: PublishingConfig, userId: string) {
  return getDb().transaction(async tx => {
    const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, publishingKey)).for("update");
    const [after] = await tx.insert(siteSettings).values({ key: publishingKey, value: values, description: "Cấu hình xuất bản, SEO và robots", updatedBy: userId })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: values, description: "Cấu hình xuất bản, SEO và robots", updatedBy: userId, updatedAt: new Date() } }).returning();
    await tx.insert(auditLogs).values({ userId, action: "publishing_config.update", entityType: "site_setting", entityId: after.id, beforeData: before?.value ?? null, afterData: values });
    return after;
  });
}
