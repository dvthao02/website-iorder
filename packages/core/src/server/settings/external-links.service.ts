import { eq } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { auditLogs, siteSettings } from "@iorder/core/db/schema";

import { externalLinksSchema } from "./external-links.contract";
import { parseStoredSetting } from "./stored-setting";
import { assertContentVersion, ContentVersionConflictError } from "../shared/content-version";

const settingKey = "external_links";

export async function getExternalLinks() {
  const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, settingKey)).limit(1);
  return row ? parseStoredSetting(externalLinksSchema, row.value, settingKey) : null;
}

// Giá trị và version đọc từ cùng một dòng để CMS không nhận dữ liệu cũ kèm version mới.
export async function getExternalLinksWithVersion() {
  const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, settingKey)).limit(1);
  return { links: row ? parseStoredSetting(externalLinksSchema, row.value, settingKey) : null, version: row?.version ?? 0 };
}

export async function updateExternalLinks(input: unknown, userId: string, expectedVersion?: number) {
  const values = externalLinksSchema.parse(input);
  const version = await getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, settingKey)).for("update");
    // expectedVersion undefined: seed/hệ thống ghi, bỏ qua kiểm tra; CMS luôn gửi.
    if (expectedVersion !== undefined) assertContentVersion(before?.version ?? 0, expectedVersion);
    const version = (before?.version ?? 0) + 1;
    // Lần lưu đầu chưa có dòng để khóa: điều kiện version ở nhánh ON CONFLICT chặn ghi đè đồng thời.
    const [after] = await tx.insert(siteSettings).values({ key: settingKey, value: values, description: "Liên kết ngoài hiển thị trên website", updatedBy: userId, version })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: values, description: "Liên kết ngoài hiển thị trên website", updatedBy: userId, version, updatedAt: new Date() }, setWhere: eq(siteSettings.version, version - 1) }).returning();
    if (!after) throw new ContentVersionConflictError();
    await tx.insert(auditLogs).values({ userId, action: "external_links.update", entityType: "site_setting", entityId: after.id, beforeData: before?.value ?? null, afterData: values });
    return after.version;
  });
  return { links: values, version };
}
