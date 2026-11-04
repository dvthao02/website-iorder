import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@iorder/core/db/client";
import { siteSettings } from "@iorder/core/db/schema";

import { parseStoredSetting } from "../settings/stored-setting";

// scripts/backup.sh (VPS) và scripts/backup.ps1 (Windows) ghi hai khóa này vào site_settings sau mỗi lần chạy;
// nút "Sao lưu ngay"/"Phục hồi" trong CMS (local-ops.ts) ghi trực tiếp bằng Drizzle. Đổi cấu trúc ở đây thì sửa cả hai script.
export const backupSuccessKey = "system.backup.success";
export const backupFailureKey = "system.backup.failure";
export const backupHistoryKey = "system.backup.history";
export const backupHistoryLimit = 30;
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
// Nút "Phục hồi" ghi sau khi xong: dữ liệu vừa phục hồi (gồm cả hai khóa trạng thái và lịch sử!) là bản chụp
// của CHÍNH site_settings tại thời điểm tạo bản sao lưu được chọn, nên phải ghi đè lại bằng snapshot chụp
// ngay trước khi phục hồi (xem snapshotBackupBookkeeping/restoreBackupBookkeeping) rồi thêm dòng này, để lịch
// sử không bị "lùi về quá khứ" và vẫn thấy có một lần phục hồi vừa xảy ra.
export const backupRestoreSchema = z.object({
  restoredAt: z.iso.datetime({ offset: true }),
  source,
  location,
  repoDir,
  fromStamp: z.string().max(40),
});

export type BackupSuccess = z.infer<typeof backupSuccessSchema>;
export type BackupFailure = z.infer<typeof backupFailureSchema>;
export type BackupRestoreEvent = z.infer<typeof backupRestoreSchema>;
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
  | ({ kind: "success"; ranAt: Date } & Omit<BackupSuccess, "finishedAt">)
  | ({ kind: "failure"; ranAt: Date } & Omit<BackupFailure, "failedAt">)
  | ({ kind: "restore"; ranAt: Date } & Omit<BackupRestoreEvent, "restoredAt">);

/** Lịch sử do script/CMS ghi (mới nhất trước); phần tử lệch schema bị bỏ qua thay vì làm hỏng cả trang. */
export function parseBackupHistory(value: unknown): BackupHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): BackupHistoryEntry[] => {
    const success = backupSuccessSchema.safeParse(item);
    if (success.success) { const { finishedAt, ...rest } = success.data; return [{ kind: "success", ranAt: new Date(finishedAt), ...rest }]; }
    const failure = backupFailureSchema.safeParse(item);
    if (failure.success) { const { failedAt, ...rest } = failure.data; return [{ kind: "failure", ranAt: new Date(failedAt), ...rest }]; }
    const restore = backupRestoreSchema.safeParse(item);
    if (restore.success) { const { restoredAt, ...rest } = restore.data; return [{ kind: "restore", ranAt: new Date(restoredAt), ...rest }]; }
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

async function prependHistory(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], value: unknown) {
  const [historyRow] = await tx.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, backupHistoryKey)).for("update");
  const existing = Array.isArray(historyRow?.value) ? historyRow.value : [];
  const history = [value, ...existing].slice(0, backupHistoryLimit);
  await tx.insert(siteSettings).values({ key: backupHistoryKey, value: history, description: "Các lần sao lưu/phục hồi gần đây, mới nhất trước (script hoặc CMS tự ghi, giữ 30 lần)" })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: history, updatedAt: new Date(), version: sql`${siteSettings.version} + 1` } });
}

async function recordBackupEntry(key: typeof backupSuccessKey | typeof backupFailureKey, value: BackupSuccess | BackupFailure, description: string) {
  await getDb().transaction(async (tx) => {
    await tx.insert(siteSettings).values({ key, value, description })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date(), version: sql`${siteSettings.version} + 1` } });
    await prependHistory(tx, value);
  });
}

export async function recordBackupSuccess(entry: Omit<BackupSuccess, "finishedAt">) {
  await recordBackupEntry(backupSuccessKey, { ...entry, finishedAt: new Date().toISOString() }, "Lần sao lưu thành công gần nhất (CMS tự ghi)");
}

export async function recordBackupFailure(entry: Omit<BackupFailure, "failedAt">) {
  await recordBackupEntry(backupFailureKey, { ...entry, failedAt: new Date().toISOString() }, "Lần sao lưu lỗi gần nhất (CMS tự ghi)");
}

/** Chỉ thêm một dòng vào lịch sử, không đụng "lần sao lưu gần nhất" (đó là chuyện của backup, không phải restore). */
export async function recordBackupRestoreEvent(entry: Omit<BackupRestoreEvent, "restoredAt">) {
  await getDb().transaction(async (tx) => { await prependHistory(tx, { ...entry, restoredAt: new Date().toISOString() }); });
}

export type BackupBookkeepingSnapshot = { key: string; value: unknown; description: string | null }[];

// Ba khóa ghi chép (success/failure/history) nằm trong CHÍNH database bị phục hồi: pg_restore sẽ viết đè
// chúng về đúng như lúc tạo bản sao lưu đang phục hồi, "xóa" mất mọi lần sao lưu/phục hồi ghi sau đó. Chụp
// lại trước khi đụng tới database thật, rồi ghi đè lại sau khi phục hồi xong để lịch sử không bị lùi về quá khứ.
export async function snapshotBackupBookkeeping(): Promise<BackupBookkeepingSnapshot> {
  return getDb().select({ key: siteSettings.key, value: siteSettings.value, description: siteSettings.description }).from(siteSettings)
    .where(inArray(siteSettings.key, [backupSuccessKey, backupFailureKey, backupHistoryKey]));
}

export async function restoreBackupBookkeeping(snapshot: BackupBookkeepingSnapshot) {
  const byKey = new Map(snapshot.map((row) => [row.key, row]));
  await getDb().transaction(async (tx) => {
    for (const key of [backupSuccessKey, backupFailureKey, backupHistoryKey]) {
      const row = byKey.get(key);
      if (!row) { await tx.delete(siteSettings).where(eq(siteSettings.key, key)); continue; }
      await tx.insert(siteSettings).values({ key, value: row.value, description: row.description })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value: row.value, description: row.description, updatedAt: new Date(), version: sql`${siteSettings.version} + 1` } });
    }
  });
}
