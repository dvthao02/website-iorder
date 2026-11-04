// Sao lưu/phục hồi "một cú bấm" cho CMS (/admin/backup): làm đúng các bước mà scripts/backup.ps1 và các
// bước thủ công trong docs/PROJECT.md đã mô tả, nhưng gọi trực tiếp từ Backend (không cần mở PowerShell,
// không cần biết Docker là gì) — dành cho người vận hành không rành kỹ thuật.
//
// An toàn: chỉ chạy khi DATABASE_URL trỏ vào localhost (assertLocalDatabaseUrl); phục hồi luôn tự sao lưu
// dữ liệu hiện tại trước, rồi phục hồi thử vào database tạm để chắc bản dump dùng được, mới đụng tới
// database thật; chỉ một lượt sao lưu/phục hồi chạy cùng lúc (operationLock).
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { getDb } from "@iorder/core/db/client";
import { auditLogs } from "@iorder/core/db/schema";

import { recordBackupFailure, recordBackupRestoreEvent, recordBackupSuccess, restoreBackupBookkeeping, snapshotBackupBookkeeping } from "./backup-status";

// audit_logs cũng nằm trong database bị phục hồi nên không tránh được việc một phục hồi "xóa" audit log ghi
// sau thời điểm bản được chọn (khác site_settings, audit_logs không được chụp/khôi phục lại) — chấp nhận vì
// system.backup.history mới là nơi theo dõi chính của tính năng này; dòng audit.log dưới đây chỉ để tiện xem
// trong Nhật ký hoạt động, không phải nguồn sự thật duy nhất.
async function recordBackupAudit(actorId: string | undefined, action: "backup.run" | "backup.restore", data: Record<string, unknown>) {
  if (!actorId) return;
  await getDb().insert(auditLogs).values({ userId: actorId, action, entityType: "backup", entityId: null, afterData: data }).catch(() => undefined);
}

const temporaryDatabase = "iorder_restore_check";
const defaultKeep = 14;
const execFileAsync = promisify(execFile);
const scheduledTaskName = "iOrder sao luu";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu biến môi trường ${name}.`);
  return value;
}

/** Sao lưu/phục hồi một cú bấm chỉ hỗ trợ cơ sở dữ liệu đang chạy ngay trên máy này. */
export function assertLocalDatabaseUrl() {
  const hostname = new URL(requiredEnv("DATABASE_URL")).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    throw new Error("Sao lưu/phục hồi một cú bấm chỉ hỗ trợ cơ sở dữ liệu chạy trên máy này (localhost). Trên máy chủ thật, hãy làm theo các bước thủ công.");
  }
}

function databaseCredentials() {
  const url = new URL(requiredEnv("DATABASE_URL"));
  return { database: url.pathname.replace(/^\//, ""), user: decodeURIComponent(url.username) };
}

/** apps/backend chạy với thư mục làm việc là apps/backend (pnpm --filter chạy script tại đó). */
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
    if (io.input) streams.push(pipeline(createReadStream(io.input), child.stdin!));
    if (io.output) streams.push(pipeline(child.stdout!, createWriteStream(io.output)));
    child.on("error", (error) => reject(new Error(`Không chạy được Docker: ${error.message}. Docker Desktop có đang mở không?`)));
    child.on("close", (code) => {
      Promise.all(streams).then(() => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `Lệnh trong container kết thúc với mã lỗi ${code}.`));
      }, reject);
    });
  });
}

async function sha256(file: string) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
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
    sums.push(`${await sha256(file)}  ./${name}.dump`);
  }
  await writeFile(path.join(folder, "SHA256SUMS"), `${sums.join("\n")}\n`, "utf8");
  return { database, folder, databaseBytes: totalBytes };
}

/** Phục hồi thử một tệp .dump vào database tạm rồi xóa ngay; trả về vài số liệu để biết bản dump có dùng được không. */
async function verifyDumpFile(repoRoot: string, envFile: string, dumpFile: string) {
  const { user } = databaseCredentials();
  await runInDbContainer(repoRoot, envFile, `dropdb -U '${user}' --if-exists '${temporaryDatabase}' && createdb -U '${user}' '${temporaryDatabase}'`);
  try {
    await runInDbContainer(repoRoot, envFile, `pg_restore -U '${user}' --no-owner --exit-on-error -d '${temporaryDatabase}'`, { input: dumpFile });
    const countsFile = path.join(path.dirname(dumpFile), ".counts");
    await runInDbContainer(repoRoot, envFile,
      `psql -U '${user}' -d '${temporaryDatabase}' -tA -F ' ' -c "select (select count(*) from drizzle.__drizzle_migrations), (select count(*) from users), (select count(*) from media_assets)"`,
      { output: countsFile });
    const [migrations = "0", users = "0", media = "0"] = (await readFile(countsFile, "utf8")).trim().split(" ");
    await rm(countsFile, { force: true });
    if (Number(migrations) === 0 || Number(users) === 0) throw new Error("Bản sao lưu phục hồi thử ra một cơ sở dữ liệu trống.");
    return { users: Number(users), mediaAssets: Number(media) };
  } finally {
    await runInDbContainer(repoRoot, envFile, `dropdb -U '${user}' --if-exists '${temporaryDatabase}'`).catch(() => undefined);
  }
}

async function pruneOldBackups(backupDir: string, keep: number) {
  const dbRoot = path.join(backupDir, "db");
  const entries = (await readdir(dbRoot, { withFileTypes: true }).catch(() => [])).filter((entry) => entry.isDirectory() && !entry.name.endsWith(".partial")).map((entry) => entry.name).sort();
  const old = entries.slice(0, Math.max(0, entries.length - keep));
  for (const name of old) await rm(path.join(dbRoot, name), { recursive: true, force: true });
  return old.length;
}

// --- Media (ảnh, tệp): cùng cách làm với scripts/backup-media.mjs, viết lại để Backend gọi trực tiếp. ---

function s3Client() {
  return new S3Client({
    credentials: { accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"), secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY") },
    endpoint: requiredEnv("S3_ENDPOINT"),
    forcePathStyle: true,
    region: "us-east-1",
  });
}

async function* listBucket(client: S3Client, bucket: string) {
  let ContinuationToken: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken }));
    yield* page.Contents ?? [];
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
}

async function backupMedia(root: string) {
  const bucket = requiredEnv("S3_BUCKET");
  const client = s3Client();
  await mkdir(root, { recursive: true });
  let copied = 0, unchanged = 0;
  for await (const object of listBucket(client, bucket)) {
    if (!object.Key || object.Key.includes("..") || object.Key.includes("\\")) continue;
    const target = path.join(root, ...object.Key.split("/"));
    const currentSize = await stat(target).then((info) => info.size, () => null);
    if (currentSize === object.Size) { unchanged++; continue; }
    await mkdir(path.dirname(target), { recursive: true });
    const partial = `${target}.part`;
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: object.Key }));
    await pipeline(result.Body as NodeJS.ReadableStream, createWriteStream(partial));
    await rename(partial, target);
    copied++;
  }
  return { copied, unchanged };
}

async function* walk(root: string, dir = root): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(root, full);
    else if (entry.isFile() && !entry.name.endsWith(".part")) yield path.relative(root, full);
  }
}

async function restoreMedia(root: string) {
  const bucket = requiredEnv("S3_BUCKET");
  const client = s3Client();
  try { await client.send(new HeadBucketCommand({ Bucket: bucket })); } catch { await client.send(new CreateBucketCommand({ Bucket: bucket })); }
  const existing = new Set<string>();
  for await (const object of listBucket(client, bucket)) if (object.Key) existing.add(object.Key);
  let uploaded = 0;
  for await (const relative of walk(root)) {
    const key = relative.split(path.sep).join("/");
    if (existing.has(key)) continue;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: createReadStream(path.join(root, relative)), ContentLength: (await stat(path.join(root, relative))).size }));
    uploaded++;
  }
  return { uploaded };
}

// --- Điều phối: hai hành động CMS gọi qua POST /api/admin/backup. ---

export type LocalBackupOutcome = { ok: true; stamp: string; databaseBytes: number; verified: boolean; users: number | null; mediaAssets: number | null; mediaCopied: number } | { ok: false; message: string };
type LocalBackupSuccess = Extract<LocalBackupOutcome, { ok: true }>;

let operationInProgress = false;

function stampNow() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

// Thân của "Sao lưu ngay", không tự khóa — runLocalBackup() khóa khi gọi độc lập; restoreLocalBackup() gọi
// thẳng hàm này vì đã giữ khóa từ trước (tự sao lưu dữ liệu hiện tại là bước đầu của phục hồi).
async function performBackup(): Promise<LocalBackupSuccess> {
  assertLocalDatabaseUrl();
  const { repoRoot, envFile, backupDir } = localBackupConfig();
  await assertRepoRoot(repoRoot);
  const stamp = stampNow();
  const { database, databaseBytes } = await dumpDatabases(repoRoot, envFile, backupDir, stamp);
  const verify = await verifyDumpFile(repoRoot, envFile, path.join(backupDir, "db", stamp, `${database}.dump`));
  const media = await backupMedia(path.join(backupDir, "media"));
  await pruneOldBackups(backupDir, defaultKeep);
  await recordBackupSuccess({ source: "windows", location: backupDir, repoDir: repoRoot, stamp, database, databaseBytes, verified: true, users: verify.users, mediaAssets: verify.mediaAssets });
  return { ok: true, stamp, databaseBytes, verified: true, users: verify.users, mediaAssets: verify.mediaAssets, mediaCopied: media.copied };
}

/** "Sao lưu ngay": dump + khôi phục thử + sao lưu media + dọn bản cũ + ghi trạng thái. Không đụng dữ liệu đang chạy. */
export async function runLocalBackup(actorId?: string): Promise<LocalBackupOutcome> {
  if (operationInProgress) return { ok: false, message: "Đang có một lượt sao lưu/phục hồi khác chạy, đợi lượt đó xong." };
  operationInProgress = true;
  try {
    const result = await performBackup();
    await recordBackupAudit(actorId, "backup.run", { stamp: result.stamp, databaseBytes: result.databaseBytes });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordBackupFailure({ source: "windows", message }).catch(() => undefined);
    return { ok: false, message };
  } finally {
    operationInProgress = false;
  }
}

export type LocalRestoreOutcome = { ok: true; preBackup: LocalBackupSuccess } | { ok: false; message: string };

/**
 * "Phục hồi": tự sao lưu dữ liệu hiện tại trước (không bỏ qua được), phục hồi thử bản đã chọn vào database
 * tạm để chắc dùng được, rồi mới ghi đè database thật và đưa lại media còn thiếu. CMS/Website có thể báo lỗi
 * vài giây trong lúc này; tải lại trang là xong, không cần khởi động lại.
 *
 * site_settings (gồm cả lịch sử sao lưu) nằm trong chính database bị phục hồi, nên pg_restore sẽ ghi đè nó về
 * đúng như lúc tạo bản đang phục hồi — snapshotBackupBookkeeping/restoreBackupBookkeeping chụp lại trước và
 * ghi đè lại sau để lịch sử không bị "lùi về quá khứ", rồi recordBackupRestoreEvent thêm một dòng "đã phục hồi".
 */
export async function restoreLocalBackup(stamp: string, actorId?: string): Promise<LocalRestoreOutcome> {
  if (operationInProgress) return { ok: false, message: "Đang có một lượt sao lưu/phục hồi khác chạy, đợi lượt đó xong." };
  operationInProgress = true;
  // Khai báo ngoài try để khối catch (cấp cứu khi phục hồi lỗi giữa chừng) vẫn dùng được.
  let repoRoot = "", envFile = "", database = "", user = "";
  let preBackupDumpFile: string | null = null; // khác null từ lúc có bản sao lưu an toàn để còn đường cấp cứu
  let droppedLiveDatabase = false;
  try {
    assertLocalDatabaseUrl();
    ({ database, user } = databaseCredentials());
    const config = localBackupConfig();
    ({ repoRoot, envFile } = config);
    const backupDir = config.backupDir;
    await assertRepoRoot(repoRoot);
    const dumpFile = path.join(backupDir, "db", stamp, `${database}.dump`);
    if (!(await stat(dumpFile).catch(() => null))) throw new Error("Không tìm thấy tệp sao lưu của lần này trên máy (có thể đã bị dọn vì quá cũ).");

    const preBackup = await performBackup().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Không sao lưu được dữ liệu hiện tại trước khi phục hồi, dừng lại để an toàn: ${message}`);
    });
    preBackupDumpFile = path.join(backupDir, "db", preBackup.stamp, `${database}.dump`);
    const bookkeeping = await snapshotBackupBookkeeping(); // chụp SAU preBackup nên đã gồm cả preBackup

    await verifyDumpFile(repoRoot, envFile, dumpFile); // chắc bản muốn phục hồi còn dùng được trước khi đụng tới dữ liệu thật

    droppedLiveDatabase = true;
    await runInDbContainer(repoRoot, envFile, `dropdb -U '${user}' '${database}' && createdb -U '${user}' '${database}'`);
    await runInDbContainer(repoRoot, envFile, `pg_restore -U '${user}' --no-owner --exit-on-error -d '${database}'`, { input: dumpFile });
    droppedLiveDatabase = false;

    await restoreMedia(path.join(backupDir, "media"));
    await restoreBackupBookkeeping(bookkeeping);
    await recordBackupRestoreEvent({ source: "windows", location: backupDir, repoDir: repoRoot, fromStamp: stamp });
    await recordBackupAudit(actorId, "backup.restore", { fromStamp: stamp, preBackupStamp: preBackup.stamp });
    return { ok: true, preBackup };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!droppedLiveDatabase) return { ok: false, message };
    // Đã xóa database thật mà phục hồi chưa xong: CMS tự nó cũng không đọc được gì nữa. Cố khôi phục khẩn
    // cấp lại bản sao lưu an toàn vừa tạo trước khi phục hồi, để ít nhất không mất trắng dữ liệu.
    try {
      await runInDbContainer(repoRoot, envFile, `dropdb -U '${user}' --if-exists '${database}' && createdb -U '${user}' '${database}'`);
      await runInDbContainer(repoRoot, envFile, `pg_restore -U '${user}' --no-owner --exit-on-error -d '${database}'`, { input: preBackupDumpFile! });
      return { ok: false, message: `Phục hồi lỗi: ${message}. Đã tự khôi phục lại dữ liệu như trước khi bấm phục hồi (không mất gì); hãy thử lại sau.` };
    } catch (recoveryError) {
      return { ok: false, message: `Phục hồi lỗi: ${message}. Khôi phục khẩn cấp SAU ĐÓ cũng lỗi: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}. Cơ sở dữ liệu đang trống — cần người quản trị máy chủ can thiệp ngay bằng tệp ${preBackupDumpFile}.` };
    }
  } finally {
    operationInProgress = false;
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
  try {
    await execFileAsync("schtasks", ["/Delete", "/TN", scheduledTaskName, "/F"]);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
