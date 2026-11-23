import { lstat, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { backupStampSchema } from "./backup-status";

// Các bản sao lưu nằm trên đĩa của máy này, mỗi bản một thư mục <thư-mục-sao-lưu>/db/<mã-thời-gian>/ chứa tệp
// .dump và SHA256SUMS. Thư mục do CMS/backup.ps1 tạo, hoặc do người vận hành chép vào ("nhập" bản sao lưu).

/** Người dùng làm sai điều kiện (xóa bản duy nhất, bản không còn…): báo lại nguyên văn, không phải lỗi hệ thống. */
export class BackupRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupRefusedError";
  }
}

export type LocalBackupEntry = {
  stamp: string;
  takenAt: Date;
  bytes: number;
  dumps: string[];
  /** Tệp .dump sẽ dùng để phục hồi database chính; null nếu không xác định được. */
  mainDump: string | null;
  hasChecksums: boolean;
  /** Lý do chưa phục hồi được (thiếu tệp), null nếu sẵn sàng. */
  problem: string | null;
};

export type LocalBackupLibrary = {
  backupDir: string;
  /** Thư mục người vận hành chép bản sao lưu vào. */
  dbDir: string;
  /** Mới nhất trước. */
  backups: LocalBackupEntry[];
  /** Mục trong thư mục db không nhận ra được (tên không đúng dạng mã thời gian…). */
  ignored: string[];
};

export function stampToDate(stamp: string) {
  return new Date(stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z"));
}

/**
 * Tệp dump của database chính: ưu tiên đúng tên <database>.dump; bản chép từ máy khác (tên database khác) thì
 * nhận tệp .dump duy nhất không phải của Umami — pg_dump --no-owner nên nạp vào database tên nào cũng được.
 */
export function pickMainDump(dumps: string[], database: string): string | null {
  const exact = `${database}.dump`;
  if (dumps.includes(exact)) return exact;
  const candidates = dumps.filter((name) => name !== "umami.dump");
  return candidates.length === 1 ? candidates[0]! : null;
}

/** Đọc một thư mục bản sao lưu; null nếu không phải thư mục thật (liên kết, tệp lẻ…). */
export async function inspectBackupFolder(dbDir: string, stamp: string, database: string): Promise<LocalBackupEntry | null> {
  const folder = path.join(dbDir, stamp);
  const info = await lstat(folder).catch(() => null);
  if (!info?.isDirectory()) return null;
  const files = (await readdir(folder, { withFileTypes: true }).catch(() => [])).filter((entry) => entry.isFile()).map((entry) => entry.name);
  const dumps = files.filter((name) => name.endsWith(".dump")).sort();
  const bytes = (await Promise.all(dumps.map(async (name) => (await stat(path.join(folder, name))).size))).reduce((sum, size) => sum + size, 0);
  const mainDump = pickMainDump(dumps, database);
  const hasChecksums = files.includes("SHA256SUMS");
  const problem = !mainDump ? "Không xác định được tệp .dump của database chính" : !hasChecksums ? "Thiếu tệp SHA256SUMS" : null;
  return { stamp, takenAt: stampToDate(stamp), bytes, dumps, mainDump, hasChecksums, problem };
}

export async function scanBackupLibrary(backupDir: string, database: string): Promise<LocalBackupLibrary> {
  const dbDir = path.join(backupDir, "db");
  const names = await readdir(dbDir, { withFileTypes: true }).catch(() => []);
  const backups: LocalBackupEntry[] = [];
  const ignored: string[] = [];
  for (const entry of names) {
    if (entry.name.startsWith(".") || entry.name.endsWith(".partial")) continue; // tệp khóa, bản đang dở của script
    const entryResult = backupStampSchema.safeParse(entry.name).success ? await inspectBackupFolder(dbDir, entry.name, database) : null;
    if (entryResult) backups.push(entryResult);
    else ignored.push(entry.name);
  }
  backups.sort((a, b) => b.stamp.localeCompare(a.stamp));
  return { backupDir, dbDir, backups, ignored: ignored.sort() };
}

/** Mã thời gian các bản dùng để tính số bản giữ lại: chỉ thư mục đúng dạng, bỏ bản đang dở và mục lạ. */
export async function listBackupStamps(backupDir: string): Promise<string[]> {
  const entries = await readdir(path.join(backupDir, "db"), { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory() && backupStampSchema.safeParse(entry.name).success).map((entry) => entry.name).sort();
}

/** Xóa bản cũ, chỉ giữ `keep` bản mới nhất (và không bao giờ xóa `protect`). Trả về số bản đã xóa. */
export async function pruneOldBackups(backupDir: string, keep: number, protect: readonly string[] = []) {
  const stamps = await listBackupStamps(backupDir);
  const old = stamps.slice(0, Math.max(0, stamps.length - keep)).filter((stamp) => !protect.includes(stamp));
  for (const stamp of old) await rm(path.join(backupDir, "db", stamp), { recursive: true, force: true });
  return old.length;
}

/**
 * Xóa tay một bản. Không xóa được bản phục hồi được cuối cùng: còn ít nhất một bản dùng được thì mới cho xóa
 * (bản hỏng/thiếu tệp thì xóa thoải mái).
 */
export async function deleteBackupFolder(backupDir: string, stamp: string, database: string): Promise<void> {
  if (!backupStampSchema.safeParse(stamp).success) throw new BackupRefusedError("Tên bản sao lưu không hợp lệ.");
  const library = await scanBackupLibrary(backupDir, database);
  const target = library.backups.find((backup) => backup.stamp === stamp);
  if (!target) throw new BackupRefusedError("Không tìm thấy bản sao lưu này trên máy (có thể đã bị xóa hoặc dọn).");
  if (!target.problem && !library.backups.some((backup) => backup.stamp !== stamp && !backup.problem)) {
    throw new BackupRefusedError("Đây là bản sao lưu dùng được cuối cùng nên không xóa. Hãy sao lưu mới trước rồi xóa bản này.");
  }
  // stamp đã qua backupStampSchema nên không thể chứa dấu phân cách đường dẫn; so sánh lại để chắc nằm đúng trong thư mục db.
  const dbDir = path.resolve(backupDir, "db");
  const folder = path.resolve(dbDir, stamp);
  if (path.dirname(folder) !== dbDir) throw new BackupRefusedError("Tên bản sao lưu không hợp lệ.");
  await rm(folder, { recursive: true, force: false });
}
