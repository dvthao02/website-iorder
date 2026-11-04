import { inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@iorder/core/db/client";
import { siteSettings } from "@iorder/core/db/schema";

import { parseStoredSetting } from "../settings/stored-setting";

// scripts/backup.sh (VPS) và scripts/backup.ps1 (Windows) ghi hai khóa này vào site_settings sau mỗi lần chạy.
// Đổi cấu trúc ở đây thì sửa cả hai script.
export const backupSuccessKey = "system.backup.success";
export const backupFailureKey = "system.backup.failure";
export const backupHistoryKey = "system.backup.history";
// Sao lưu chạy mỗi đêm; quá 36 giờ chưa có bản mới nghĩa là lịch chạy đã hỏng.
export const backupStaleAfterHours = 36;

const source = z.enum(["vps", "windows"]);
// Thư mục sao lưu và thư mục repo trên máy chạy script (để điền sẵn lệnh phục hồi); bản ghi cũ không có.
const location = z.string().max(300).optional();
const repoDir = z.string().max(300).optional();
export const backupSuccessSchema = z.object({
  finishedAt: z.iso.datetime({ offset: true }),
  source,
  location,
  repoDir,
  stamp: z.string().max(40),
  database: z.string().max(63).optional(),
  databaseBytes: z.number().int().nonnegative(),
  verified: z.boolean(),
  users: z.number().int().nonnegative().nullable(),
  mediaAssets: z.number().int().nonnegative().nullable(),
});
export const backupFailureSchema = z.object({
  failedAt: z.iso.datetime({ offset: true }),
  source,
  location,
  repoDir,
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

export type BackupHistoryEntry =
  | ({ ok: true; ranAt: Date } & Omit<BackupSuccess, "finishedAt">)
  | ({ ok: false; ranAt: Date } & Omit<BackupFailure, "failedAt">);

/** Lịch sử do script ghi (mới nhất trước); phần tử lệch schema bị bỏ qua thay vì làm hỏng cả trang. */
export function parseBackupHistory(value: unknown): BackupHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): BackupHistoryEntry[] => {
    const success = backupSuccessSchema.safeParse(item);
    if (success.success) { const { finishedAt, ...rest } = success.data; return [{ ok: true, ranAt: new Date(finishedAt), ...rest }]; }
    const failure = backupFailureSchema.safeParse(item);
    if (failure.success) { const { failedAt, ...rest } = failure.data; return [{ ok: false, ranAt: new Date(failedAt), ...rest }]; }
    return [];
  });
}

async function readBackupSettings(keys: string[]) {
  const rows = await getDb().select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings).where(inArray(siteSettings.key, keys));
  return new Map(rows.map((row) => [row.key, row.value]));
}

function statusFrom(values: Map<string, unknown>, now: Date) {
  return summarizeBackupStatus(
    values.has(backupSuccessKey) ? parseStoredSetting(backupSuccessSchema, values.get(backupSuccessKey), backupSuccessKey) : null,
    values.has(backupFailureKey) ? parseStoredSetting(backupFailureSchema, values.get(backupFailureKey), backupFailureKey) : null,
    now,
  );
}

export async function getBackupStatus(now = new Date()): Promise<BackupStatus> {
  return statusFrom(await readBackupSettings([backupSuccessKey, backupFailureKey]), now);
}

/** Trang "Sao lưu & phục hồi": trạng thái + lịch sử 30 lần gần nhất. */
export async function getBackupOverview(now = new Date()): Promise<{ status: BackupStatus; history: BackupHistoryEntry[] }> {
  const values = await readBackupSettings([backupSuccessKey, backupFailureKey, backupHistoryKey]);
  return { status: statusFrom(values, now), history: parseBackupHistory(values.get(backupHistoryKey)) };
}
