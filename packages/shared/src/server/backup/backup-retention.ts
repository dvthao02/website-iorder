import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs, siteSettings } from "@iorder/shared/db/schema";

import { assertContentVersion, ContentVersionConflictError } from "../shared/content-version";

// Số bản database giữ lại khi dọn: Super Admin chỉnh trong CMS (màn Sao lưu), lưu ở site_settings để cả nút
// "Sao lưu ngay" lẫn scripts/backup.ps1 và backup.sh (chạy theo lịch) cùng đọc. Đổi cấu trúc ở đây thì sửa cả hai script.
export const backupKeepKey = "system.backup.keep";
export const backupKeepDefault = 14;
// Tối thiểu 3: phục hồi tự sao lưu hiện trạng trước, cần chỗ cho bản đó và ít nhất một bản dự phòng.
export const backupKeepMin = 3;
export const backupKeepMax = 60;
export const backupKeepSchema = z.number().int().min(backupKeepMin).max(backupKeepMax);

const description = "Số bản sao lưu database giữ lại khi dọn (Super Admin chỉnh trong CMS)";

/** Giá trị thiếu hoặc hỏng (ghi tay vào DB) dùng mặc định thay vì chặn việc sao lưu. */
export async function getBackupKeep(): Promise<{ keep: number; version: number }> {
  const [row] = await getDb().select({ value: siteSettings.value, version: siteSettings.version }).from(siteSettings).where(eq(siteSettings.key, backupKeepKey)).limit(1);
  const parsed = backupKeepSchema.safeParse(row?.value);
  return { keep: parsed.success ? parsed.data : backupKeepDefault, version: row?.version ?? 0 };
}

export async function updateBackupKeep(keep: number, userId: string, expectedVersion: number): Promise<{ keep: number; version: number }> {
  const value = backupKeepSchema.parse(keep);
  const version = await getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, backupKeepKey)).for("update");
    assertContentVersion(before?.version ?? 0, expectedVersion);
    const next = (before?.version ?? 0) + 1;
    // Lần lưu đầu chưa có dòng để khóa: điều kiện version ở nhánh ON CONFLICT chặn ghi đè đồng thời.
    const [after] = await tx.insert(siteSettings).values({ key: backupKeepKey, value, description, updatedBy: userId, version: next })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value, description, updatedBy: userId, version: next, updatedAt: new Date() }, setWhere: eq(siteSettings.version, next - 1) }).returning();
    if (!after) throw new ContentVersionConflictError();
    await tx.insert(auditLogs).values({ userId, action: "backup.keep_update", entityType: "backup", entityId: null, beforeData: before?.value ?? null, afterData: value });
    return after.version;
  });
  return { keep: value, version };
}
