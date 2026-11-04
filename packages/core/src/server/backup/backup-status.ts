import { inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@iorder/core/db/client";
import { siteSettings } from "@iorder/core/db/schema";

import { parseStoredSetting } from "../settings/stored-setting";

// scripts/backup.sh (VPS) và scripts/backup.ps1 (Windows) ghi hai khóa này vào site_settings sau mỗi lần chạy.
// Đổi cấu trúc ở đây thì sửa cả hai script.
export const backupSuccessKey = "system.backup.success";
export const backupFailureKey = "system.backup.failure";
// Sao lưu chạy mỗi đêm; quá 36 giờ chưa có bản mới nghĩa là lịch chạy đã hỏng.
export const backupStaleAfterHours = 36;

const source = z.enum(["vps", "windows"]);
export const backupSuccessSchema = z.object({
  finishedAt: z.iso.datetime({ offset: true }),
  source,
  stamp: z.string().max(40),
  databaseBytes: z.number().int().nonnegative(),
  verified: z.boolean(),
  users: z.number().int().nonnegative().nullable(),
  mediaAssets: z.number().int().nonnegative().nullable(),
});
export const backupFailureSchema = z.object({
  failedAt: z.iso.datetime({ offset: true }),
  source,
  message: z.string().max(500),
});

export type BackupSuccess = z.infer<typeof backupSuccessSchema>;
export type BackupFailure = z.infer<typeof backupFailureSchema>;
export type BackupState = "never" | "ok" | "stale" | "failed";
export type BackupStatus = {
  state: BackupState;
  lastSuccess: (Omit<BackupSuccess, "finishedAt"> & { finishedAt: Date }) | null;
  lastFailure: (Omit<BackupFailure, "failedAt"> & { failedAt: Date }) | null;
};

/** Lỗi mới hơn lần thành công gần nhất → "failed"; thành công quá cũ → "stale". */
export function summarizeBackupStatus(success: BackupSuccess | null, failure: BackupFailure | null, now = new Date()): BackupStatus {
  const lastSuccess = success ? { ...success, finishedAt: new Date(success.finishedAt) } : null;
  const lastFailure = failure ? { ...failure, failedAt: new Date(failure.failedAt) } : null;
  const state: BackupState = lastFailure && (!lastSuccess || lastFailure.failedAt > lastSuccess.finishedAt) ? "failed"
    : !lastSuccess ? "never"
    : now.getTime() - lastSuccess.finishedAt.getTime() > backupStaleAfterHours * 3_600_000 ? "stale"
    : "ok";
  return { state, lastSuccess, lastFailure };
}

export async function getBackupStatus(now = new Date()): Promise<BackupStatus> {
  const rows = await getDb().select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings)
    .where(inArray(siteSettings.key, [backupSuccessKey, backupFailureKey]));
  const value = (key: string) => rows.find((row) => row.key === key)?.value;
  return summarizeBackupStatus(
    rows.some((row) => row.key === backupSuccessKey) ? parseStoredSetting(backupSuccessSchema, value(backupSuccessKey), backupSuccessKey) : null,
    rows.some((row) => row.key === backupFailureKey) ? parseStoredSetting(backupFailureSchema, value(backupFailureKey), backupFailureKey) : null,
    now,
  );
}
