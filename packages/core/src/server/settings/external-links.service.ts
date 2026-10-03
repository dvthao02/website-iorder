import { eq } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { auditLogs, siteSettings } from "@iorder/core/db/schema";

import { externalLinksSchema } from "./external-links.contract";

const settingKey = "external_links";

export async function getExternalLinks() {
  const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, settingKey)).limit(1);
  return row ? externalLinksSchema.parse(row.value) : null;
}

export async function updateExternalLinks(input: unknown, userId: string) {
  const values = externalLinksSchema.parse(input);
  await getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, settingKey)).for("update");
    const [after] = await tx.insert(siteSettings).values({ key: settingKey, value: values, description: "Liên kết ngoài hiển thị trên website", updatedBy: userId })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: values, description: "Liên kết ngoài hiển thị trên website", updatedBy: userId, updatedAt: new Date() } }).returning();
    await tx.insert(auditLogs).values({ userId, action: "external_links.update", entityType: "site_setting", entityId: after.id, beforeData: before?.value ?? null, afterData: values });
  });
  return values;
}
