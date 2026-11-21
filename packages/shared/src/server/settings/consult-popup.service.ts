import { eq } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs, siteSettings } from "@iorder/shared/db/schema";

import { consultPopupSchema } from "./consult-popup.contract";
import { parseStoredSetting } from "./stored-setting";
import { assertContentVersion, ContentVersionConflictError } from "../shared/content-version";

const settingKey = "consult_popup";
const description = "Cửa sổ tư vấn tự hiện trên website";

export async function getConsultPopup() {
  const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, settingKey)).limit(1);
  return row ? parseStoredSetting(consultPopupSchema, row.value, settingKey) : null;
}

// Giá trị và version đọc từ cùng một dòng để CMS không nhận dữ liệu cũ kèm version mới.
export async function getConsultPopupWithVersion() {
  const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, settingKey)).limit(1);
  return { popup: row ? parseStoredSetting(consultPopupSchema, row.value, settingKey) : null, version: row?.version ?? 0 };
}

export async function updateConsultPopup(input: unknown, userId: string, expectedVersion?: number) {
  const values = consultPopupSchema.parse(input);
  const version = await getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, settingKey)).for("update");
    // expectedVersion undefined: seed/hệ thống ghi, bỏ qua kiểm tra; CMS luôn gửi.
    if (expectedVersion !== undefined) assertContentVersion(before?.version ?? 0, expectedVersion);
    const version = (before?.version ?? 0) + 1;
    // Lần lưu đầu chưa có dòng để khóa: điều kiện version ở nhánh ON CONFLICT chặn ghi đè đồng thời.
    const [after] = await tx.insert(siteSettings).values({ key: settingKey, value: values, description, updatedBy: userId, version })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: values, description, updatedBy: userId, version, updatedAt: new Date() }, setWhere: eq(siteSettings.version, version - 1) }).returning();
    if (!after) throw new ContentVersionConflictError();
    await tx.insert(auditLogs).values({ userId, action: "consult_popup.update", entityType: "site_setting", entityId: after.id, beforeData: before?.value ?? null, afterData: values });
    return after.version;
  });
  return { popup: values, version };
}
