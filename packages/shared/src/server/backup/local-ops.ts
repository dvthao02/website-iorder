// Sao lưu/phục hồi "một cú bấm" cho CMS (/admin/backup): làm đúng các bước mà scripts/backup.ps1 và các
// bước thủ công trong docs/DEPLOYMENT.md đã mô tả, nhưng gọi trực tiếp từ Backend (không cần mở PowerShell,
// không cần biết Docker là gì) — dành cho người vận hành không rành kỹ thuật.
//
// An toàn: chỉ chạy khi DATABASE_URL trỏ vào localhost (assertLocalDatabaseUrl); phục hồi kiểm tra checksum bản
// dump, tự sao lưu dữ liệu hiện tại trước, dựng bản phục hồi vào database tạm (vừa để chắc dùng được vừa để
// đổi tên thay vào chỗ database thật, xem database-swap.ts); chỉ một lượt sao lưu/phục hồi chạy cùng lúc, kể cả
// với script chạy theo lịch (operationInProgress trong tiến trình + khóa tệp .lock giữa các tiến trình).
import { execFile, spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs } from "@iorder/shared/db/schema";

import { BackupRefusedError, deleteBackupFolder, inspectBackupFolder, pruneOldBackups, scanBackupLibrary, type LocalBackupLibrary } from "./backup-library";
import { backupKeepDefault, getBackupKeep } from "./backup-retention";
import { restoreActorSessions, snapshotActorSessions } from "./backup-sessions";
import { backupStampSchema, recordBackupFailure, recordBackupRestoreEvent, recordBackupSuccess, restoreBackupBookkeeping, snapshotBackupBookkeeping } from "./backup-status";
import { assertDatabaseName, DatabaseSwapError, retryAsync, swapDatabases } from "./database-swap";
import { BackupIntegrityError, sha256File, verifyDumpChecksum } from "./dump-integrity";
import { acquireBackupFileLock } from "./operation-lock";
import { createStoredZip } from "./stored-zip";
import { withTemporaryDatabase } from "./temporary-database";

// audit_logs cũng nằm trong database bị phục hồi nên không tránh được việc một phục hồi "xóa" audit log ghi
// sau thời điểm bản được chọn (khác site_settings, audit_logs không được chụp/khôi phục lại) — chấp nhận vì
// system.backup.history mới là nơi theo dõi chính của tính năng này; dòng audit.log dưới đây chỉ để tiện xem
// trong Nhật ký hoạt động, không phải nguồn sự thật duy nhất.
async function recordBackupAudit(actorId: string | undefined, action: "backup.run" | "backup.restore" | "backup.delete" | "backup.export", data: Record<string, unknown>) {
  if (!actorId) return;
  await getDb().insert(auditLogs).values({ userId: actorId, action, entityType: "backup", entityId: null, afterData: data }).catch(() => undefined);
}

const execFileAsync = promisify(execFile);
const scheduledTaskName = "iOrder sao luu";
const busyMessage = "Đang có một lượt sao lưu/phục hồi khác chạy, đợi lượt đó xong.";
const fileLockBusyMessage = "Một lượt sao lưu khác (chạy theo lịch hoặc bằng lệnh) đang chạy, đợi lượt đó xong.";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu biến môi trường ${name}.`);
  return value;
}

/**
 * Lý do "Sao lưu ngay", phục hồi một cú bấm và lịch tự động không chạy được: CMS không ở cùng máy với database
 * (thường là CMS chạy trong Docker, database là container `db`). Đây không phải sao lưu lỗi nên không ghi vào lịch sử hay thông báo.
 */
export const unsupportedBackupMessage = "CMS đang chạy trong Docker (hoặc ở máy khác với database) nên không điều khiển được sao lưu một cú bấm. Hãy sao lưu bằng lệnh trên máy: pnpm backup:local (Windows) hoặc scripts/backup.sh (VPS), và đặt lịch tự động mỗi đêm bằng pnpm backup:schedule (Windows) hoặc cron (VPS); kết quả hiện ở Lịch sử và Tình trạng.";

/** Sao lưu/phục hồi một cú bấm chỉ hỗ trợ cơ sở dữ liệu đang chạy ngay trên máy này. */
export function assertLocalDatabaseUrl() {
  const hostname = new URL(requiredEnv("DATABASE_URL")).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    throw new Error(unsupportedBackupMessage);
  }
}

function databaseCredentials() {
  const url = new URL(requiredEnv("DATABASE_URL"));
  return { database: assertDatabaseName(url.pathname.replace(/^\//, "")), user: decodeURIComponent(url.username) };
}

/** Sao lưu một cú bấm chạy được khi database ở ngay máy này (localhost); trong Docker (host `db`) hoặc database ở máy khác thì không. */
export function isOneClickBackupSupported() {
  try {
    assertLocalDatabaseUrl();
    return true;
  } catch {
    return false;
  }
}

/** apps/api chạy với thư mục làm việc là apps/api (pnpm --filter chạy script tại đó). */
export function localBackupConfig() {
  const repoRoot = process.env.BACKUP_REPO_ROOT ?? path.resolve(process.cwd(), "..", "..");
  const envFile = process.env.BACKUP_ENV_FILE ?? path.join(repoRoot, ".env");
  const backupDir = process.env.BACKUP_LOCAL_DIR ?? path.resolve(repoRoot, "..", "iorder-backups");
  return { repoRoot, envFile, backupDir };
}

async function assertRepoRoot(repoRoot: string) {
  try {
    await stat(path.join(repoRoot, "compose.yaml"));
  } catch {
    throw new Error(`Không tìm thấy compose.yaml ở ${repoRoot}. Đặt biến môi trường BACKUP_REPO_ROOT trỏ đúng thư mục chứa mã nguồn.`);
  }
}

// Chạy một lệnh "docker compose ... exec -T db sh -c <command>", nối stdin/stdout với tệp trên máy khi cần
// (dump/khôi phục dữ liệu nhị phân) thay vì đọc hết vào bộ nhớ.
function runInDbContainer(repoRoot: string, envFile: string, command: string, io: { input?: string; output?: string } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["compose", "--env-file", envFile, "exec", "-T", "db", "sh", "-c", command], { cwd: repoRoot, stdio: [io.input ? "pipe" : "ignore", io.output ? "pipe" : "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8").slice(0, 2000); });
    const streams: Promise<void>[] = [];
    // Đường dẫn do lúc chạy quyết định (thư mục sao lưu ngoài mã nguồn): không để Turbopack đưa cả dự án vào bản build.
    if (io.input) streams.push(pipeline(createReadStream(/* turbopackIgnore: true */ io.input), child.stdin!));
    if (io.output) streams.push(pipeline(child.stdout!, createWriteStream(/* turbopackIgnore: true */ io.output)));
    child.on("error", (error) => reject(new Error(`Không chạy được Docker: ${error.message}. Docker Desktop có đang mở không?`)));
    child.on("close", (code) => {
      Promise.all(streams).then(() => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `Lệnh trong container kết thúc với mã lỗi ${code}.`));
      }, reject);
    });
  });
}

/** Dump database chính (và umami nếu có) vào <backupDir>/db/<stamp>/, kèm SHA256SUMS. */
async function dumpDatabases(repoRoot: string, envFile: string, backupDir: string, stamp: string) {
  const { database, user } = databaseCredentials();
  const hasUmami = await runInDbContainer(repoRoot, envFile, `psql -U '${user}' -d '${database}' -tAc "select 1 from pg_database where datname = 'umami'" | grep -q 1`).then(() => true, () => false);
  const databases = hasUmami ? [database, "umami"] : [database];
  const folder = path.join(backupDir, "db", stamp);
  await mkdir(folder, { recursive: true });
  let totalBytes = 0;
  const sums: string[] = [];
  for (const name of databases) {
    const file = path.join(folder, `${name}.dump`);
    await runInDbContainer(repoRoot, envFile, `pg_dump -U '${user}' -Fc --no-owner '${name}'`, { output: file });
    await runInDbContainer(repoRoot, envFile, "pg_restore --list > /dev/null", { input: file });
    totalBytes += (await stat(file)).size;
    sums.push(`${await sha256File(file)}  ./${name}.dump`);
  }
  await writeFile(path.join(folder, "SHA256SUMS"), `${sums.join("\n")}\n`, "utf8");
  return { database, folder, databaseBytes: totalBytes };
}

/** Nạp một tệp .dump vào database trống đã tạo sẵn rồi đếm vài số liệu; ném lỗi nếu ra một cơ sở dữ liệu trống. */
async function loadDumpAndCount(repoRoot: string, envFile: string, target: string, dumpFile: string) {
  const { user } = databaseCredentials();
  await runInDbContainer(repoRoot, envFile, `pg_restore -U '${user}' --no-owner --exit-on-error -d '${target}'`, { input: dumpFile });
  const countsFile = path.join(path.dirname(dumpFile), ".counts");
  try {
    await runInDbContainer(repoRoot, envFile,
      `psql -U '${user}' -d '${target}' -tA -F ' ' -c "select (select count(*) from drizzle.__drizzle_migrations), (select count(*) from users u where to_jsonb(u)->>'deleted_at' is null), (select count(*) from media_assets)"`,
      { output: countsFile });
    const [migrations = "0", users = "0", media = "0"] = (await readFile(countsFile, "utf8")).trim().split(" ");
    if (Number(migrations) === 0 || Number(users) === 0) throw new Error("Bản sao lưu phục hồi thử ra một cơ sở dữ liệu trống.");
    return { users: Number(users), mediaAssets: Number(media), migrations: Number(migrations) };
  } finally {
    await rm(countsFile, { force: true });
  }
}

/** Phục hồi thử một tệp .dump vào database tạm rồi xóa ngay; trả về vài số liệu để biết bản dump có dùng được không. */
async function verifyDumpFile(repoRoot: string, envFile: string, dumpFile: string) {
  const { user } = databaseCredentials();
  return withTemporaryDatabase({
    create: name => runInDbContainer(repoRoot, envFile, `createdb -U '${user}' '${name}'`),
    remove: name => runInDbContainer(repoRoot, envFile, `dropdb -U '${user}' --if-exists '${name}'`),
    use: temporaryDatabase => loadDumpAndCount(repoRoot, envFile, temporaryDatabase, dumpFile),
  });
}

/** Số bản giữ lại do Super Admin chỉnh; không đọc được thì dùng mặc định thay vì làm hỏng lượt sao lưu. */
async function currentKeep() {
  return getBackupKeep().then((setting) => setting.keep, () => backupKeepDefault);
}

/** Bản sao lưu từ phiên bản hệ thống mới hơn (nhiều migration hơn mã đang chạy) có thể làm website lỗi: từ chối. */
async function assertSchemaNotNewer(repoRoot: string, migrations: number) {
  const journal = await readFile(path.join(repoRoot, "drizzle", "meta", "_journal.json"), "utf8").then((text) => JSON.parse(text) as { entries?: unknown[] }, () => null);
  const known = Array.isArray(journal?.entries) ? journal.entries.length : null;
  if (known !== null && migrations > known) {
    throw new Error(`Bản sao lưu này tạo từ phiên bản hệ thống mới hơn (${migrations} migration, bản đang chạy chỉ có ${known}). Hãy cập nhật hệ thống lên bản mới trước khi phục hồi.`);
  }
}

// --- Media (ảnh, tệp): chạy đúng scripts/backup-media.mjs mà backup.ps1/backup.sh dùng, để chỉ có một bản logic
// đối soát (ETag, sổ manifest, tệp khác nội dung). Script đọc S3_* từ môi trường của Backend. ---

export type MediaBackupSummary = { copied: number; updated: number; unchanged: number; skipped: number; failed: number };
export type MediaRestoreSummary = { uploaded: number; overwritten: number; present: number; different: number; skipped: number };

function runMediaScript<T>(repoRoot: string, mode: "backup" | "restore", directory: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const script = path.join(repoRoot, "scripts", "backup-media.mjs");
    // NODE_OPTIONS của Next (dev) không nên lọt vào tiến trình con.
    const child = spawn(process.execPath, [script, mode, directory, "--json"], { cwd: repoRoot, env: { ...process.env, NODE_OPTIONS: "" }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout = (stdout + chunk.toString("utf8")).slice(-4000); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("utf8")).slice(-2000); });
    child.on("error", (error) => reject(new Error(`Không chạy được tiến trình sao lưu media: ${error.message}`)));
    child.on("close", (code) => {
      const label = mode === "backup" ? "Sao lưu" : "Phục hồi";
      if (code !== 0) return reject(new Error(`${label} media lỗi (storage có đang chạy không?): ${stderr.trim() || stdout.trim() || `mã lỗi ${code}`}`));
      const summary = stdout.trim().split(/\r?\n/).at(-1) ?? "";
      try { resolve(JSON.parse(summary) as T); } catch { reject(new Error(`${label} media xong nhưng không đọc được kết quả: ${summary || "(trống)"}`)); }
    });
  });
}

// --- Điều phối: hai hành động CMS gọi qua POST /api/v1/admin/backup. ---

export type LocalBackupOutcome = { ok: true; stamp: string; databaseBytes: number; verified: boolean; users: number | null; mediaAssets: number | null; mediaCopied: number } | { ok: false; message: string };
type LocalBackupSuccess = Extract<LocalBackupOutcome, { ok: true }>;

let operationInProgress = false;

function stampNow() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

// Thân của "Sao lưu ngay", không tự khóa — runLocalBackup() khóa khi gọi độc lập; restoreLocalBackup() gọi
// thẳng hàm này vì đã giữ khóa từ trước (tự sao lưu dữ liệu hiện tại là bước đầu của phục hồi).
// prune=false cho bản an toàn tạo trước phục hồi: dọn bản cũ lúc đó có thể xóa đúng bản người dùng đang chọn phục hồi.
async function performBackup({ prune = true }: { prune?: boolean } = {}): Promise<LocalBackupSuccess> {
  assertLocalDatabaseUrl();
  const { repoRoot, envFile, backupDir } = localBackupConfig();
  await assertRepoRoot(repoRoot);
  const stamp = stampNow();
  const { database, databaseBytes } = await dumpDatabases(repoRoot, envFile, backupDir, stamp);
  const verify = await verifyDumpFile(repoRoot, envFile, path.join(backupDir, "db", stamp, `${database}.dump`));
  const media = await runMediaScript<MediaBackupSummary>(repoRoot, "backup", path.join(backupDir, "media"));
  if (prune) await pruneOldBackups(backupDir, await currentKeep());
  await recordBackupSuccess({ source: "windows", location: backupDir, repoDir: repoRoot, stamp, database, databaseBytes, verified: true, users: verify.users, mediaAssets: verify.mediaAssets });
  return { ok: true, stamp, databaseBytes, verified: true, users: verify.users, mediaAssets: verify.mediaAssets, mediaCopied: media.copied + media.updated };
}

/** "Sao lưu ngay": dump + khôi phục thử + sao lưu media + dọn bản cũ + ghi trạng thái. Không đụng dữ liệu đang chạy. */
export async function runLocalBackup(actorId?: string): Promise<LocalBackupOutcome> {
  if (operationInProgress) return { ok: false, message: busyMessage };
  // Chưa chạm vào đĩa và không ghi "lỗi": môi trường không hỗ trợ không phải một lần sao lưu thất bại.
  if (!isOneClickBackupSupported()) return { ok: false, message: unsupportedBackupMessage };
  operationInProgress = true;
  let releaseFileLock: (() => Promise<void>) | null = null;
  try {
    releaseFileLock = await acquireBackupFileLock(localBackupConfig().backupDir);
    // Lượt khác đang chạy không phải là "sao lưu lỗi": không ghi vào lịch sử.
    if (!releaseFileLock) return { ok: false, message: fileLockBusyMessage };
    const result = await performBackup();
    await recordBackupAudit(actorId, "backup.run", { stamp: result.stamp, databaseBytes: result.databaseBytes });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordBackupFailure({ source: "windows", message: message.slice(0, 500) }).catch(() => undefined);
    return { ok: false, message };
  } finally {
    await releaseFileLock?.();
    operationInProgress = false;
  }
}

/** sessionKept: phiên đăng nhập của người bấm còn dùng được sau phục hồi; false thì họ phải đăng nhập lại (tài khoản không có trong bản phục hồi). */
export type LocalRestoreOutcome = { ok: true; preBackup: LocalBackupSuccess; media: MediaRestoreSummary; sessionKept: boolean } | { ok: false; message: string };

/**
 * "Phục hồi": kiểm tra checksum bản đã chọn, tự sao lưu dữ liệu hiện tại trước (không bỏ qua được), dựng bản
 * đã chọn vào database tạm (cũng là lần phục hồi thử), đưa lại media còn thiếu, rồi mới đổi tên database tạm
 * thành database thật. CMS/Website có thể báo lỗi một, hai giây lúc đổi tên; tải lại trang là xong. Nếu có lỗi
 * trước hoặc trong lúc đổi tên, database thật không bị đụng tới (hoặc được đổi tên trở lại).
 *
 * site_settings (gồm cả lịch sử sao lưu) nằm trong chính database bị phục hồi, nên bản mới mang theo đúng như
 * lúc tạo bản đang phục hồi — snapshotBackupBookkeeping/restoreBackupBookkeeping chụp lại trước và ghi đè lại
 * sau để lịch sử không bị "lùi về quá khứ", rồi recordBackupRestoreEvent thêm một dòng "đã phục hồi".
 */
export async function restoreLocalBackup(stamp: string, actorId?: string): Promise<LocalRestoreOutcome> {
  if (!backupStampSchema.safeParse(stamp).success) return { ok: false, message: "Tên bản sao lưu không hợp lệ." };
  if (operationInProgress) return { ok: false, message: busyMessage };
  if (!isOneClickBackupSupported()) return { ok: false, message: unsupportedBackupMessage };
  operationInProgress = true;
  let releaseFileLock: (() => Promise<void>) | null = null;
  let swapped = false; // từ lúc true, database thật đã là bản phục hồi: lỗi sau đó không còn "không mất gì"
  try {
    assertLocalDatabaseUrl();
    const { database, user } = databaseCredentials();
    const { repoRoot, envFile, backupDir } = localBackupConfig();
    await assertRepoRoot(repoRoot);
    releaseFileLock = await acquireBackupFileLock(backupDir);
    if (!releaseFileLock) throw new Error(fileLockBusyMessage);

    const folder = path.join(backupDir, "db", stamp);
    const selected = await inspectBackupFolder(path.join(backupDir, "db"), stamp, database);
    if (!selected) throw new Error("Không tìm thấy bản sao lưu này trên máy (có thể đã bị xóa hoặc dọn vì quá cũ).");
    // Bản chép từ máy khác có thể mang tên database khác: pickMainDump chọn tệp .dump phù hợp.
    if (!selected.mainDump) throw new Error(selected.problem ?? "Không xác định được tệp .dump của database chính trong bản sao lưu này.");
    const dumpName = selected.mainDump;
    const dumpFile = path.join(folder, dumpName);
    await verifyDumpChecksum(folder, dumpName);

    const preBackup = await performBackup({ prune: false }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Không sao lưu được dữ liệu hiện tại trước khi phục hồi, dừng lại để an toàn: ${message}`);
    });
    const bookkeeping = await snapshotBackupBookkeeping(); // chụp SAU preBackup nên đã gồm cả preBackup
    const carriedSessions = actorId ? await snapshotActorSessions(actorId) : [];
    const previousDatabase = `iorder_before_restore_${preBackup.stamp.toLowerCase()}`;
    const runMaintenanceSql = (sql: string) => runInDbContainer(repoRoot, envFile, `psql -U '${user}' -d postgres -q -v ON_ERROR_STOP=1 -c '${sql}'`);

    const media = await withTemporaryDatabase({
      create: name => runInDbContainer(repoRoot, envFile, `createdb -U '${user}' '${name}'`),
      remove: name => runInDbContainer(repoRoot, envFile, `dropdb -U '${user}' --if-exists '${name}'`),
      use: async (staging) => {
        const loaded = await loadDumpAndCount(repoRoot, envFile, staging, dumpFile); // bản muốn phục hồi dùng được thì mới đi tiếp
        await assertSchemaNotNewer(repoRoot, loaded.migrations);
        // Media chỉ bổ sung tệp thiếu nên làm trước khi đổi database: lỗi ở đây không để lại gì cần dọn.
        const restoredMedia = await runMediaScript<MediaRestoreSummary>(repoRoot, "restore", path.join(backupDir, "media"));
        await swapDatabases({ run: runMaintenanceSql, live: database, staging, previous: previousDatabase });
        swapped = true;
        return restoredMedia;
      },
    });

    // Các kết nối cũ của Backend vừa bị ngắt khi đổi tên; thử lại vài lần nếu kết nối nào còn sót.
    let sessionKept = false;
    await retryAsync(async () => {
      sessionKept = (await restoreActorSessions(carriedSessions)) > 0;
      await restoreBackupBookkeeping(bookkeeping);
      await recordBackupRestoreEvent({ source: "windows", location: backupDir, repoDir: repoRoot, fromStamp: stamp });
    }, 3, 500);
    await recordBackupAudit(actorId, "backup.restore", { fromStamp: stamp, preBackupStamp: preBackup.stamp });
    // Bản cũ đã có trong preBackup; giữ nó lại chỉ tốn chỗ.
    await runInDbContainer(repoRoot, envFile, `dropdb -U '${user}' --if-exists --force '${previousDatabase}'`).catch(() => undefined);
    // Dọn bản cũ bị hoãn ở bước tạo bản an toàn; không xóa đúng bản vừa phục hồi từ đó (người dùng có thể cần lại).
    await pruneOldBackups(backupDir, await currentKeep(), [stamp]).catch(() => undefined);
    return { ok: true, preBackup, media, sessionKept };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // DatabaseSwapError đã tự mô tả database nào còn dữ liệu cũ (đã đổi lại hay cần người can thiệp).
    if (error instanceof DatabaseSwapError) return { ok: false, message };
    if (swapped) return { ok: false, message: `Đã phục hồi dữ liệu xong nhưng bước ghi lịch sử sau đó lỗi: ${message}. Dữ liệu đã đúng bản được chọn; tải lại trang để kiểm tra.` };
    return { ok: false, message };
  } finally {
    await releaseFileLock?.();
    operationInProgress = false;
  }
}

// --- Thư viện bản sao lưu trên đĩa: xem, tải về, xóa tay. Bản do CMS/script tạo hoặc do người vận hành chép vào
// thư mục db đều hiện như nhau (xem backup-library.ts). ---

/** null khi database không chạy trên máy này: các thao tác một cú bấm không hỗ trợ, CMS ẩn mục này. */
export async function listLocalBackups(): Promise<LocalBackupLibrary | null> {
  try {
    assertLocalDatabaseUrl();
    const { database } = databaseCredentials();
    return await scanBackupLibrary(localBackupConfig().backupDir, database);
  } catch {
    return null;
  }
}

export type LocalDeleteOutcome = { ok: true } | { ok: false; message: string; refused: boolean };

/** Xóa tay một bản sao lưu. Chỉ chạy khi không có lượt sao lưu/phục hồi nào đang chạy (kể cả script theo lịch). */
export async function deleteLocalBackup(stamp: string, actorId?: string): Promise<LocalDeleteOutcome> {
  if (!backupStampSchema.safeParse(stamp).success) return { ok: false, message: "Tên bản sao lưu không hợp lệ.", refused: true };
  if (operationInProgress) return { ok: false, message: busyMessage, refused: true };
  operationInProgress = true;
  let releaseFileLock: (() => Promise<void>) | null = null;
  try {
    assertLocalDatabaseUrl();
    const { database } = databaseCredentials();
    const { backupDir } = localBackupConfig();
    releaseFileLock = await acquireBackupFileLock(backupDir);
    if (!releaseFileLock) return { ok: false, message: fileLockBusyMessage, refused: true };
    await deleteBackupFolder(backupDir, stamp, database);
    await recordBackupAudit(actorId, "backup.delete", { stamp });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), refused: error instanceof BackupRefusedError };
  } finally {
    await releaseFileLock?.();
    operationInProgress = false;
  }
}

export type BackupDownload = { ok: true; fileName: string; size: number; stream: () => Readable } | { ok: false; message: string; refused: boolean };

/**
 * Đóng gói một bản sao lưu (các tệp .dump + SHA256SUMS) thành .zip để cất ở nơi khác hoặc nhập vào máy khác. Kiểm tra
 * checksum trước để không đưa người dùng một bản đã hỏng mà tưởng còn tốt. Media nằm ở thư mục media riêng, không có trong gói.
 */
export async function prepareBackupDownload(stamp: string, actorId?: string): Promise<BackupDownload> {
  if (!backupStampSchema.safeParse(stamp).success) return { ok: false, message: "Tên bản sao lưu không hợp lệ.", refused: true };
  try {
    assertLocalDatabaseUrl();
    const { database } = databaseCredentials();
    const { backupDir } = localBackupConfig();
    const dbDir = path.join(backupDir, "db");
    const backup = await inspectBackupFolder(dbDir, stamp, database);
    if (!backup) return { ok: false, message: "Không tìm thấy bản sao lưu này trên máy (có thể đã bị xóa hoặc dọn).", refused: true };
    if (!backup.mainDump || !backup.hasChecksums) return { ok: false, message: backup.problem ?? "Bản sao lưu thiếu tệp.", refused: true };
    const folder = path.join(dbDir, stamp);
    for (const dump of backup.dumps) await verifyDumpChecksum(folder, dump);
    const zip = await createStoredZip([...backup.dumps, "SHA256SUMS"].map((name) => ({ name, file: path.join(folder, name) })), backup.takenAt);
    await recordBackupAudit(actorId, "backup.export", { stamp, bytes: zip.size });
    return { ok: true, fileName: `iorder-sao-luu-${stamp}.zip`, size: zip.size, stream: zip.stream };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), refused: error instanceof BackupRefusedError || error instanceof BackupIntegrityError };
  }
}

// --- Lịch tự động hằng đêm trên Windows: đăng ký thẳng vào Task Scheduler bằng schtasks.exe (có sẵn trên
// Windows, không cần quyền quản trị để tạo tác vụ cho chính tài khoản đang đăng nhập) — người dùng chỉ bấm
// nút, không phải tự mở Task Scheduler hay gõ lệnh. Tác vụ chạy scripts/backup.ps1 trực tiếp (không qua CMS)
// nên vẫn chạy được cả khi không ai mở CMS lúc đó.

export async function isNightlyBackupScheduled(): Promise<boolean> {
  try {
    await execFileAsync("schtasks", ["/Query", "/TN", scheduledTaskName]);
    return true;
  } catch {
    return false;
  }
}

export async function scheduleNightlyBackup(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isOneClickBackupSupported()) return { ok: false, message: unsupportedBackupMessage };
  try {
    const { repoRoot } = localBackupConfig();
    await assertRepoRoot(repoRoot);
    const scriptPath = path.join(repoRoot, "scripts", "backup.ps1");
    const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;
    await execFileAsync("schtasks", ["/Create", "/SC", "DAILY", "/ST", "21:00", "/TN", scheduledTaskName, "/TR", command, "/F"]);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function unscheduleNightlyBackup(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isOneClickBackupSupported()) return { ok: false, message: unsupportedBackupMessage };
  try {
    await execFileAsync("schtasks", ["/Delete", "/TN", scheduledTaskName, "/F"]);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
