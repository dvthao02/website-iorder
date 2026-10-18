import { eq } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, siteSettings } from "@iorder/core/db/schema";
import type { PublishingConfig } from "./publishing.contract";
import { assertContentVersion, ContentVersionConflictError } from "../shared/content-version";

const publishingKey = "publishing";
export async function findPublishingConfig() { const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, publishingKey)).limit(1); return row; }
export function savePublishingConfig(values: PublishingConfig, userId: string, expectedVersion?: number) {
  return getDb().transaction(async tx => {
    const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, publishingKey)).for("update");
    // expectedVersion undefined: seed/hệ thống ghi, bỏ qua kiểm tra; CMS luôn gửi.
    if (expectedVersion !== undefined) assertContentVersion(before?.version ?? 0, expectedVersion);
    const version = (before?.version ?? 0) + 1;
    // Lần lưu đầu chưa có dòng để khóa: điều kiện version ở nhánh ON CONFLICT chặn ghi đè đồng thời.
    const [after] = await tx.insert(siteSettings).values({ key: publishingKey, value: values, description: "Cấu hình xuất bản, SEO và robots", updatedBy: userId, version })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: values, description: "Cấu hình xuất bản, SEO và robots", updatedBy: userId, version, updatedAt: new Date() }, setWhere: eq(siteSettings.version, version - 1) }).returning();
    if (!after) throw new ContentVersionConflictError();
    await tx.insert(auditLogs).values({ userId, action: "publishing_config.update", entityType: "site_setting", entityId: after.id, beforeData: before?.value ?? null, afterData: values });
    return after;
  });
}
