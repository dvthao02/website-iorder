// Sao lưu/khôi phục media theo từng object qua S3 API (không chép thô volume đang chạy).
//   node scripts/backup-media.mjs backup <thư-mục>   tải object còn thiếu hoặc đổi kích thước về thư mục
//   node scripts/backup-media.mjs restore <thư-mục>  đưa lên bucket các object bucket chưa có (không ghi đè)
// Bản sao lưu chỉ thêm, không xóa: dump database cũ vẫn tìm được tệp đã bị dọn khỏi S3.
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const partialSuffix = ".part";

// Key S3 → đường dẫn trong thư mục sao lưu; từ chối key có thể thoát ra ngoài thư mục.
export function keyToRelativePath(key) {
  const segments = key.split("/");
  if (!key || key.includes("\\") || key.includes("\0") || key.endsWith(partialSuffix)) return null;
  if (segments.some(segment => segment === "" || segment === "." || segment === "..")) return null;
  return path.join(...segments);
}

export function relativePathToKey(relativePath) {
  return relativePath.split(path.sep).join("/");
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

async function backup(client, bucket, root) {
  let copied = 0, unchanged = 0, skipped = 0;
  for await (const object of listObjects(client, bucket)) {
    const relative = keyToRelativePath(object.Key ?? "");
    if (!relative) { skipped++; console.warn(`Bỏ qua key không hợp lệ: ${JSON.stringify(object.Key)}`); continue; }
    const target = path.join(root, relative);
    if (await fileSize(target) === object.Size) { unchanged++; continue; }
    await mkdir(path.dirname(target), { recursive: true });
    const partial = target + partialSuffix;
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: object.Key }));
    try {
      await pipeline(result.Body, createWriteStream(partial));
      await rename(partial, target);
    } catch (error) {
      await rm(partial, { force: true });
      throw error;
    }
    copied++;
  }
  console.log(`Sao lưu media: ${copied} tệp mới, ${unchanged} không đổi, ${skipped} bỏ qua.`);
  if (skipped) process.exitCode = 1;
}

async function* walk(root, dir = root) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(root, full);
    else if (entry.isFile() && !entry.name.endsWith(partialSuffix)) yield path.relative(root, full);
  }
}

async function restore(client, bucket, root) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  const existing = new Set();
  for await (const object of listObjects(client, bucket)) existing.add(object.Key);
  let uploaded = 0, present = 0;
  for await (const relative of walk(root)) {
    const key = relativePathToKey(relative);
    if (existing.has(key)) { present++; continue; }
    const file = path.join(root, relative);
    // Content-Type khi phục vụ lấy từ bảng media_assets, không phụ thuộc metadata của object.
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: createReadStream(file), ContentLength: await fileSize(file) }));
    uploaded++;
  }
  console.log(`Khôi phục media: ${uploaded} tệp đã đưa lên, ${present} đã có sẵn.`);
}

async function main() {
  const [mode, dir] = process.argv.slice(2);
  if (!["backup", "restore"].includes(mode) || !dir) {
    throw new Error("Cách dùng: node scripts/backup-media.mjs <backup|restore> <thư-mục>");
  }
  const root = path.resolve(dir);
  await mkdir(root, { recursive: true });
  const client = createClient();
  if (mode === "backup") await backup(client, process.env.S3_BUCKET, root);
  else await restore(client, process.env.S3_BUCKET, root);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
