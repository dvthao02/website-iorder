import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { backup, isPlainMd5Etag, keyToRelativePath, loadManifest, manifestName, normalizeEtag, parseArguments, planBackupObject, relativePathToKey, restore, sameAsRemote } from "./backup-media.mjs";

const md5 = (text) => createHash("md5").update(text).digest("hex");

test("key S3 hợp lệ ánh xạ thành đường dẫn và ngược lại", () => {
  const relative = keyToRelativePath("media/2026/10/a.jpg");
  assert.equal(relative, path.join("media", "2026", "10", "a.jpg"));
  assert.equal(relativePathToKey(relative), "media/2026/10/a.jpg");
});

test("từ chối key có thể thoát khỏi thư mục sao lưu hoặc trùng tệp của script", () => {
  for (const key of ["", "../x", "a/../../x", "/etc/passwd", "a//b", "a/./b", "a\\b", "a/b.part", manifestName, `${manifestName}.tmp`]) {
    assert.equal(keyToRelativePath(key), null, key);
  }
});

test("ETag chuẩn hóa bỏ dấu nháy; chỉ 32 hex mới là MD5", () => {
  assert.equal(normalizeEtag('"ABCDEF0123456789abcdef0123456789"'), "abcdef0123456789abcdef0123456789");
  assert.equal(normalizeEtag(undefined), "");
  assert.equal(isPlainMd5Etag(md5("x")), true);
  assert.equal(isPlainMd5Etag(`${md5("x")}-3`), false);
  assert.equal(isPlainMd5Etag(""), false);
});

test("cách dùng: chỉ nhận cờ đúng chế độ", () => {
  assert.deepEqual(parseArguments(["backup", "dir", "--verify", "--json"]), { mode: "backup", dir: "dir", verify: true, overwrite: false, json: true });
  assert.deepEqual(parseArguments(["restore", "dir", "--overwrite"]), { mode: "restore", dir: "dir", verify: false, overwrite: true, json: false });
  for (const argv of [[], ["backup"], ["sync", "dir"], ["backup", "dir", "--overwrite"], ["restore", "dir", "--verify"], ["backup", "dir", "--xoa"]]) {
    assert.throws(() => parseArguments(argv), /Cách dùng/, argv.join(" "));
  }
});

test("kế hoạch sao lưu: cùng kích thước vẫn tải lại khi ETag nguồn đổi hoặc tệp trên đĩa sai nội dung", async () => {
  const hit = md5("v1");
  const never = () => { throw new Error("không được băm"); };
  assert.equal(await planBackupObject({ object: { size: 2, etag: hit }, localSize: null, verify: false, hashLocal: never }), "download");
  assert.equal(await planBackupObject({ object: { size: 2, etag: hit }, localSize: 5, verify: false, hashLocal: never }), "download");
  // Sổ có ETag khác: nguồn đã đổi nội dung dù kích thước như cũ.
  assert.equal(await planBackupObject({ object: { size: 2, etag: md5("v2") }, localSize: 2, entry: { size: 2, etag: hit }, verify: false, hashLocal: never }), "download");
  // Khớp sổ: không đọc tệp trên đĩa (nhanh), trừ khi --verify.
  assert.equal(await planBackupObject({ object: { size: 2, etag: hit }, localSize: 2, entry: { size: 2, etag: hit }, verify: false, hashLocal: never }), "unchanged");
  assert.equal(await planBackupObject({ object: { size: 2, etag: hit }, localSize: 2, entry: { size: 2, etag: hit }, verify: true, hashLocal: async () => md5("hỏng") }), "download");
  // Bản sao lưu cũ chưa có sổ: phải băm để chứng minh.
  assert.equal(await planBackupObject({ object: { size: 2, etag: hit }, localSize: 2, verify: false, hashLocal: async () => hit }), "unchanged");
  assert.equal(await planBackupObject({ object: { size: 2, etag: hit }, localSize: 2, verify: false, hashLocal: async () => md5("khác") }), "download");
  // ETag multipart không băm được: tin vào kích thước.
  assert.equal(await planBackupObject({ object: { size: 2, etag: `${hit}-2` }, localSize: 2, verify: true, hashLocal: never }), "unchanged");
});

test("so với bucket: khác kích thước hoặc khác MD5 là khác nội dung", async () => {
  const hit = md5("a");
  assert.equal(await sameAsRemote({ localSize: 1, remote: { size: 2, etag: hit }, hashLocal: async () => hit }), false);
  assert.equal(await sameAsRemote({ localSize: 1, remote: { size: 1, etag: hit }, hashLocal: async () => md5("b") }), false);
  assert.equal(await sameAsRemote({ localSize: 1, remote: { size: 1, etag: hit }, hashLocal: async () => hit }), true);
  assert.equal(await sameAsRemote({ localSize: 1, remote: { size: 1, etag: `${hit}-2` }, hashLocal: async () => { throw new Error("không được băm"); } }), true);
});

// S3 giả trong bộ nhớ: đủ bốn lệnh mà script dùng.
function fakeS3(initial = {}) {
  const objects = new Map(Object.entries(initial).map(([key, body]) => [key, Buffer.from(body)]));
  const puts = [];
  return {
    objects, puts,
    set(key, body) { objects.set(key, Buffer.from(body)); },
    async send(command) {
      if (command instanceof ListObjectsV2Command) return { Contents: [...objects].map(([Key, body]) => ({ Key, Size: body.length, ETag: `"${md5(body)}"` })), IsTruncated: false };
      if (command instanceof GetObjectCommand) return { Body: Readable.from([objects.get(command.input.Key)]) };
      if (command instanceof HeadBucketCommand) return {};
      if (command instanceof PutObjectCommand) {
        const chunks = [];
        for await (const chunk of command.input.Body) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        assert.equal(command.input.ContentLength, body.length);
        objects.set(command.input.Key, body);
        puts.push(command.input.Key);
        return {};
      }
      throw new Error(`lệnh chưa giả lập: ${command.constructor.name}`);
    },
  };
}

async function withDirectory(run) {
  const root = await mkdtemp(path.join(tmpdir(), "iorder-media-"));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("sao lưu: tải mới, bỏ qua tệp không đổi và tải lại khi nội dung đổi dù kích thước giữ nguyên", async () => {
  await withDirectory(async (root) => {
    const s3 = fakeS3({ "media/a.jpg": "AAAA", "media/b.jpg": "BBBB" });
    assert.deepEqual(await backup(s3, "bucket", root), { copied: 2, updated: 0, unchanged: 0, skipped: 0, failed: 0 });
    assert.equal(await readFile(path.join(root, "media", "a.jpg"), "utf8"), "AAAA");

    assert.deepEqual(await backup(s3, "bucket", root), { copied: 0, updated: 0, unchanged: 2, skipped: 0, failed: 0 });

    s3.set("media/a.jpg", "ZZZZ"); // cùng 4 byte, nội dung khác
    assert.deepEqual(await backup(s3, "bucket", root), { copied: 0, updated: 1, unchanged: 1, skipped: 0, failed: 0 });
    assert.equal(await readFile(path.join(root, "media", "a.jpg"), "utf8"), "ZZZZ");

    const manifest = await loadManifest(root);
    assert.equal(manifest.get("media/a.jpg")?.etag, md5("ZZZZ"));
    assert.deepEqual(await readdir(path.join(root, "media")), ["a.jpg", "b.jpg"]); // không để lại .part
  });
});

test("sao lưu: bản sao cũ chưa có sổ được băm lại; tệp hỏng cùng kích thước bị thay", async () => {
  await withDirectory(async (root) => {
    const s3 = fakeS3({ "a.txt": "đúng", "b.txt": "tốt" });
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, "a.txt"), "đúng"); // khớp
    await writeFile(path.join(root, "b.txt"), Buffer.alloc(Buffer.byteLength("tốt"), 1)); // cùng kích thước, sai nội dung
    assert.deepEqual(await backup(s3, "bucket", root), { copied: 0, updated: 1, unchanged: 1, skipped: 0, failed: 0 });
    assert.equal(await readFile(path.join(root, "b.txt"), "utf8"), "tốt");
  });
});

test("sao lưu --verify bắt tệp trên đĩa bị hỏng dù sổ vẫn khớp", async () => {
  await withDirectory(async (root) => {
    const s3 = fakeS3({ "a.txt": "1234" });
    await backup(s3, "bucket", root);
    await writeFile(path.join(root, "a.txt"), "xxxx");
    assert.equal((await backup(s3, "bucket", root)).unchanged, 1); // nhanh: tin sổ
    assert.deepEqual(await backup(s3, "bucket", root, { verify: true }), { copied: 0, updated: 1, unchanged: 0, skipped: 0, failed: 0 });
    assert.equal(await readFile(path.join(root, "a.txt"), "utf8"), "1234");
  });
});

test("sao lưu: key không hợp lệ bị bỏ qua và một tệp lỗi không chặn cả lượt", async () => {
  await withDirectory(async (root) => {
    const s3 = fakeS3({ "../thoat": "x", "ok.txt": "ok", "hong.txt": "hong" });
    const send = s3.send.bind(s3);
    s3.send = async (command) => {
      if (command instanceof GetObjectCommand && command.input.Key === "hong.txt") return { Body: Readable.from([Buffer.from("sai")]) }; // khác ETag
      return send(command);
    };
    const warn = console.warn, error = console.error;
    console.warn = () => undefined; console.error = () => undefined;
    try {
      assert.deepEqual(await backup(s3, "bucket", root), { copied: 1, updated: 0, unchanged: 0, skipped: 1, failed: 1 });
    } finally { console.warn = warn; console.error = error; }
    assert.deepEqual((await readdir(root)).sort(), [manifestName, "ok.txt"]); // không có hong.txt, cũng không .part
    assert.equal((await loadManifest(root)).has("hong.txt"), false);
  });
});

test("sổ hỏng được dựng lại thay vì làm hỏng lượt sao lưu", async () => {
  await withDirectory(async (root) => {
    await writeFile(path.join(root, manifestName), "{ không phải json");
    const s3 = fakeS3({ "a.txt": "1" });
    assert.equal((await backup(s3, "bucket", root)).copied, 1);
    assert.equal((await loadManifest(root)).size, 1);
  });
});

test("khôi phục: chỉ bổ sung tệp thiếu, báo tệp khác nội dung và không đụng sổ", async () => {
  await withDirectory(async (root) => {
    const source = fakeS3({ "keep.txt": "giu", "gone.txt": "mat", "changed.txt": "cu" });
    await backup(source, "bucket", root);
    const target = fakeS3({ "keep.txt": "giu", "changed.txt": "moi" });
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      assert.deepEqual(await restore(target, "bucket", root), { uploaded: 1, overwritten: 0, present: 1, different: 1, skipped: 0 });
    } finally { console.warn = warn; }
    assert.deepEqual(target.puts, ["gone.txt"]);
    assert.equal(target.objects.get("changed.txt")?.toString(), "moi");
    assert.equal(target.puts.includes(manifestName), false);
  });
});

test("khôi phục --overwrite ghi đè tệp khác nội dung", async () => {
  await withDirectory(async (root) => {
    await backup(fakeS3({ "changed.txt": "cu" }), "bucket", root);
    const target = fakeS3({ "changed.txt": "mo" }); // cùng kích thước 2 byte
    assert.deepEqual(await restore(target, "bucket", root, { overwrite: true }), { uploaded: 0, overwritten: 1, present: 0, different: 0, skipped: 0 });
    assert.equal(target.objects.get("changed.txt")?.toString(), "cu");
  });
});
