// Sao lưu/khôi phục media theo từng object qua S3 API (không chép thô volume đang chạy).
//   node scripts/backup-media.mjs backup <thư-mục> [--verify] [--json]
//       tải object còn thiếu hoặc đã đổi nội dung về thư mục; --verify băm lại mọi tệp trên đĩa để bắt tệp hỏng
//   node scripts/backup-media.mjs restore <thư-mục> [--overwrite] [--json]
//       đưa lên bucket các object bucket chưa có; object đã có nhưng khác nội dung chỉ được báo, --overwrite mới ghi đè
// Bản sao lưu chỉ thêm, không xóa: dump database cũ vẫn tìm được tệp đã bị dọn khỏi S3.
// Đối soát nội dung bằng ETag của S3: với object tải một lần ETag là MD5 nên so được với tệp trên đĩa; object
// multipart/mã hóa phía máy chủ không có MD5, chỉ so kích thước và ETag đã ghi trong sổ (manifest) lần trước.
// Cả CMS (local-ops.ts) lẫn scripts/backup.ps1, backup.sh đều chạy đúng tệp này, nên chỉ có một bản logic.
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const partialSuffix = ".part";
// Sổ ghi kích thước + ETag của từng object ở lần sao lưu gần nhất; nằm ngay trong thư mục media để đi cùng bản sao.
export const manifestName = ".iorder-media-manifest.json";
const manifestTempName = `${manifestName}.tmp`;

// Key S3 → đường dẫn trong thư mục sao lưu; từ chối key có thể thoát ra ngoài thư mục hoặc trùng tệp của chính script.
export function keyToRelativePath(key) {
  const segments = key.split("/");
  if (!key || key.includes("\\") || key.includes("\0") || key.endsWith(partialSuffix)) return null;
  if (key === manifestName || key === manifestTempName) return null;
  if (segments.some(segment => segment === "" || segment === "." || segment === "..")) return null;
  return path.join(...segments);
}

export function relativePathToKey(relativePath) {
  return relativePath.split(path.sep).join("/");
}

/** ETag S3 hay có dấu nháy và tiền tố W/; chuẩn hóa để so sánh. */
export function normalizeEtag(etag) {
  return String(etag ?? "").replace(/^W\//, "").replaceAll('"', "").toLowerCase();
}

/** Chỉ ETag dạng 32 ký tự hex mới là MD5 của nội dung; ETag multipart ("…-3") hoặc mã hóa thì không. */
export function isPlainMd5Etag(etag) {
  return /^[0-9a-f]{32}$/.test(etag);
}

function createClient() {
  for (const name of ["S3_ACCESS_KEY_ID", "S3_BUCKET", "S3_ENDPOINT", "S3_SECRET_ACCESS_KEY"]) {
    if (!process.env[name]) throw new Error(`Cần đặt ${name}.`);
  }
  return new S3Client({
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    region: "us-east-1",
  });
}

async function* listObjects(client, bucket) {
  let ContinuationToken;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken }));
    yield* page.Contents ?? [];
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
}

async function fileSize(file) {
  try {
    return (await stat(file)).size;
  } catch {
    return null;
  }
}

async function md5OfFile(file) {
  const hash = createHash("md5");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

export async function loadManifest(root) {
  try {
    const parsed = JSON.parse(await readFile(path.join(root, manifestName), "utf8"));
    if (parsed?.version !== 1 || typeof parsed.objects !== "object" || parsed.objects === null) return new Map();
    return new Map(Object.entries(parsed.objects).filter(([, entry]) => Number.isInteger(entry?.size) && typeof entry?.etag === "string"));
  } catch {
    // Chưa có sổ hoặc sổ hỏng: coi như chưa biết gì, lượt này sẽ băm lại tệp trên đĩa để dựng lại.
    return new Map();
  }
}

export async function saveManifest(root, entries) {
  const file = path.join(root, manifestName);
  const temporary = path.join(root, manifestTempName);
  await writeFile(temporary, JSON.stringify({ version: 1, objects: Object.fromEntries(entries) }), "utf8");
  await rename(temporary, file);
}

/**
 * Quyết định việc cần làm với một object khi sao lưu: "download" (tải mới hoặc tải lại) hay "unchanged".
 * Cùng kích thước không chứng minh cùng nội dung, nên: ETag bucket đổi so với sổ → tải lại; chưa có trong sổ
 * (bản sao lưu cũ) hoặc --verify → băm tệp trên đĩa so với MD5 của bucket khi so được.
 */
export async function planBackupObject({ object, localSize, entry, verify, hashLocal }) {
  if (localSize === null || localSize !== object.size) return "download";
  if (entry && entry.etag !== object.etag) return "download";
  if (isPlainMd5Etag(object.etag) && (verify || !entry)) return (await hashLocal()) === object.etag ? "unchanged" : "download";
  return "unchanged";
}

/** Tệp trên đĩa có cùng nội dung với object đang nằm trên bucket không (chỉ chắc chắn khi bucket có MD5). */
export async function sameAsRemote({ localSize, remote, hashLocal }) {
  if (localSize !== remote.size) return false;
  if (!isPlainMd5Etag(remote.etag)) return true;
  return (await hashLocal()) === remote.etag;
}

async function download(client, bucket, key, target, etag) {
  await mkdir(path.dirname(target), { recursive: true });
  const partial = target + partialSuffix;
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const hash = createHash("md5");
  try {
    await pipeline(result.Body, async function* (source) {
      for await (const chunk of source) { hash.update(chunk); yield chunk; }
    }, createWriteStream(partial));
    if (isPlainMd5Etag(etag) && hash.digest("hex") !== etag) throw new Error(`Tệp tải về không khớp checksum của bucket: ${key}`);
    await rename(partial, target);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
}

export async function backup(client, bucket, root, { verify = false } = {}) {
  const manifest = await loadManifest(root);
  const result = { copied: 0, updated: 0, unchanged: 0, skipped: 0, failed: 0 };
  try {
    for await (const object of listObjects(client, bucket)) {
      const relative = keyToRelativePath(object.Key ?? "");
      if (!relative) { result.skipped++; console.warn(`Bỏ qua key không hợp lệ: ${JSON.stringify(object.Key)}`); continue; }
      const target = path.join(root, relative);
      const remote = { size: object.Size, etag: normalizeEtag(object.ETag) };
      const localSize = await fileSize(target);
      try {
        const action = await planBackupObject({ object: remote, localSize, entry: manifest.get(object.Key), verify, hashLocal: () => md5OfFile(target) });
        if (action === "download") {
          await download(client, bucket, object.Key, target, remote.etag);
          if (localSize === null) result.copied++; else result.updated++;
        } else {
          result.unchanged++;
        }
        manifest.set(object.Key, remote);
      } catch (error) {
        // Một tệp lỗi không được chặn cả lượt; sổ giữ nguyên mục cũ của tệp này nên lượt sau sẽ thử lại.
        result.failed++;
        console.error(`Không sao lưu được ${object.Key}: ${error instanceof Error ? error.message : error}`);
      }
    }
  } finally {
    await saveManifest(root, manifest);
  }
  return result;
}

async function* walk(root, dir = root) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(root, full);
    else if (entry.isFile() && !entry.name.endsWith(partialSuffix) && !(dir === root && (entry.name === manifestName || entry.name === manifestTempName))) yield path.relative(root, full);
  }
}

export async function restore(client, bucket, root, { overwrite = false } = {}) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  const remote = new Map();
  for await (const object of listObjects(client, bucket)) remote.set(object.Key, { size: object.Size, etag: normalizeEtag(object.ETag) });
  const result = { uploaded: 0, overwritten: 0, present: 0, different: 0, skipped: 0 };
  for await (const relative of walk(root)) {
    const key = relativePathToKey(relative);
    if (!keyToRelativePath(key)) { result.skipped++; console.warn(`Bỏ qua tệp có tên không hợp lệ: ${JSON.stringify(key)}`); continue; }
    const file = path.join(root, relative);
    const localSize = await fileSize(file);
    const current = remote.get(key);
    if (current) {
      if (await sameAsRemote({ localSize, remote: current, hashLocal: () => md5OfFile(file) })) { result.present++; continue; }
      if (!overwrite) { result.different++; console.warn(`Khác nội dung bản sao lưu, giữ nguyên trên bucket: ${key}`); continue; }
    }
    // Content-Type khi phục vụ lấy từ bảng media_assets, không phụ thuộc metadata của object.
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: createReadStream(file), ContentLength: localSize }));
    if (current) result.overwritten++; else result.uploaded++;
  }
  return result;
}

function describe(mode, result) {
  if (mode === "backup") return `Sao lưu media: ${result.copied} tệp mới, ${result.updated} tệp đổi nội dung, ${result.unchanged} không đổi, ${result.skipped} bỏ qua, ${result.failed} lỗi.`;
  return `Khôi phục media: ${result.uploaded} tệp đã đưa lên, ${result.overwritten} ghi đè, ${result.present} đã có sẵn, ${result.different} khác nội dung (giữ nguyên), ${result.skipped} bỏ qua.`;
}

const allowedFlags = { backup: ["--verify", "--json"], restore: ["--overwrite", "--json"] };

export function parseArguments(argv) {
  const [mode, dir, ...flags] = argv;
  if (!["backup", "restore"].includes(mode) || !dir || flags.some(flag => !allowedFlags[mode].includes(flag))) {
    throw new Error("Cách dùng: node scripts/backup-media.mjs backup <thư-mục> [--verify] [--json]\n       node scripts/backup-media.mjs restore <thư-mục> [--overwrite] [--json]");
  }
  return { mode, dir, verify: flags.includes("--verify"), overwrite: flags.includes("--overwrite"), json: flags.includes("--json") };
}

async function main() {
  const { mode, dir, verify, overwrite, json } = parseArguments(process.argv.slice(2));
  const root = path.resolve(dir);
  await mkdir(root, { recursive: true });
  const client = createClient();
  const result = mode === "backup" ? await backup(client, process.env.S3_BUCKET, root, { verify }) : await restore(client, process.env.S3_BUCKET, root, { overwrite });
  // Dòng JSON cuối cùng cho chương trình gọi (CMS) đọc; người dùng chạy tay thấy câu tóm tắt.
  console.log(json ? JSON.stringify({ mode, ...result }) : describe(mode, result));
  if (result.skipped || result.failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
