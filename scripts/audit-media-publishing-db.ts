import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../packages/core/src/db/schema";
import { listMediaAssetsPage, listPublishingMediaUsage } from "../packages/core/src/server/media/media.repository";
import { mediaListQuerySchema } from "../packages/core/src/server/media/media.contract";

config({ quiet: true });
let phase = "khởi tạo";

function databaseWithWriteAfterRows(database: ReturnType<typeof drizzle<typeof schema>>, write: () => Promise<void>, readCommittedControl = false) {
  let fired = false;
  function intercept<T extends object>(query: T): T {
    return new Proxy(query, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (key === "then") return (resolve: (rows: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve(target).then(async rows => {
            if (!fired) { fired = true; await write(); }
            return rows;
          }).then(resolve, reject);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const next = Reflect.apply(value, target, args);
          return next && typeof next === "object" ? intercept(next) : next;
        };
      },
    });
  }
  type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
  return new Proxy(database, {
    get(target, key) {
      if (key !== "transaction") return Reflect.get(target, key);
      return (callback: (tx: Transaction) => Promise<unknown>, options: Parameters<typeof database.transaction>[1]) =>
        target.transaction(tx => callback(new Proxy(tx, {
          get(transaction, property) {
            if (property === "select") return (...args: unknown[]) => intercept(Reflect.apply(transaction.select, transaction, args));
            return Reflect.get(transaction, property);
          },
        })), readCommittedControl ? { ...options, isolationLevel: "read committed" } : options);
    },
  });
}
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Chỉ kiểm thử DB local.");
  const scope = `cms_audit_${randomUUID().replaceAll("-", "")}`;
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
  const writer = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
  let created = false;
  try {
    await client`create schema ${client(scope)}`;
    created = true;
    await client`create table ${client(scope)}.site_settings (like public.site_settings including all)`;
    await client`create table ${client(scope)}.media_assets (like public.media_assets including all)`;
    await client`select set_config('search_path', ${scope}, false)`;
    await client`select set_config('statement_timeout', '8000', false)`;
    const [current] = await client`select current_schema() as name`;
    assert.equal(current.name, scope);
    const database = drizzle({ client, schema });
    phase = "tạo fixture";
    const mediaId = randomUUID();
    const otherId = randomUUID();
    const [setting] = await database.insert(schema.siteSettings).values({ key: "publishing", value: { defaultOgMediaId: mediaId } }).returning({ id: schema.siteSettings.id });
    await database.insert(schema.siteSettings).values({ key: "other", value: { defaultOgMediaId: otherId } });
    phase = "query ảnh đúng";
    const found = await listPublishingMediaUsage(mediaId, database);
    assert.equal(found.length, 1);
    assert.equal(found[0].id, setting.id);
    assert.equal((await listPublishingMediaUsage(otherId, database)).length, 0);
    assert.equal((await listPublishingMediaUsage(randomUUID(), database)).length, 0);
    phase = "bỏ liên kết";
    await database.update(schema.siteSettings).set({ value: { defaultOgMediaId: null } }).where(eq(schema.siteSettings.key, "publishing"));
    assert.equal((await listPublishingMediaUsage(mediaId, database)).length, 0);
    console.log("Đạt: ảnh SEO đúng ID được nhận diện; ảnh khác/key khác/null không bị tính nhầm. Không sửa dữ liệu public.");
    phase = "phân trang media";
    const ids = Array.from({ length: 12 }, () => randomUUID()).sort();
    await database.insert(schema.mediaAssets).values(ids.map((id, index) => ({
      id, storageKey: `audit/${id}`, originalName: "Ảnh tiếng Việt 100%_",
      mimeType: index < 7 ? "image/png" : "application/pdf", fileSize: 10,
      createdAt: new Date("2026-01-01T00:00:00Z"), altText: "Mô tả riêng", caption: "Chú thích riêng",
    })));
    const query = mediaListQuerySchema.parse({ pageSize: 5 });
    const pages = await Promise.all([1, 2, 3].map(page => listMediaAssetsPage({ ...query, page }, database)));
    assert.deepEqual(pages.map(page => page.items.length), [5, 5, 2]);
    assert.ok(pages.every(page => page.total === 12 && page.totalPages === 3));
    assert.deepEqual(pages.flatMap(page => page.items.map(item => item.id)), ids);
    assert.equal((await listMediaAssetsPage({ ...query, page: 4 }, database)).items.length, 0);
    assert.equal((await listMediaAssetsPage({ ...query, type: "images" }, database)).total, 7);
    assert.equal((await listMediaAssetsPage({ ...query, type: "documents" }, database)).total, 5);
    for (const keyword of ["%_", "tiếng Việt", "Mô tả riêng", "Chú thích riêng"]) {
      assert.equal((await listMediaAssetsPage({ ...query, query: keyword }, database)).total, 12);
    }
    assert.equal((await listMediaAssetsPage({ ...query, query: "__" }, database)).total, 0);
    phase = "snapshot với writer cạnh tranh";
    await writer`select set_config('search_path', ${scope}, false)`;
    const [writerScope] = await writer`select current_schema() as name`;
    assert.equal(writerScope.name, scope);
    let writes = 0;
    const write = async () => {
      await writer`update media_assets set deleted_at=now() where id=${ids[0]}`;
      writes++;
    };
    const controlResult = await listMediaAssetsPage(query, databaseWithWriteAfterRows(database, write, true));
    assert.equal(writes, 1);
    assert.equal(controlResult.total, 11);
    assert.deepEqual(controlResult.items.map(item => item.id), ids.slice(0, 5));
    await writer`update media_assets set deleted_at=null where id=${ids[0]}`;
    writes = 0;
    const snapshot = await listMediaAssetsPage(query, databaseWithWriteAfterRows(database, write));
    assert.equal(writes, 1);
    assert.equal(snapshot.total, 12);
    assert.deepEqual(snapshot.items.map(item => item.id), ids.slice(0, 5));
    assert.equal((await listMediaAssetsPage(query, database)).total, 11);
    console.log("Đạt: đối chứng phát hiện rows/count lệch; repeatable read giữ 12 mục khi writer commit, request sau thấy 11.");
    await database.update(schema.mediaAssets).set({ deletedAt: new Date() }).where(eq(schema.mediaAssets.id, ids[0]));
    assert.equal((await listMediaAssetsPage(query, database)).total, 11);
    console.log("Đạt: phân trang 5/5/2, thứ tự ID ổn định, trang rỗng, MIME, tìm tiếng Việt/metadata/wildcard literal và soft-delete.");
  } finally {
    await writer.end({ timeout: 10 });
    if (created) {
      if (!/^cms_audit_[a-f0-9]{32}$/.test(scope)) throw new Error("Tên schema kiểm thử cần dọn không hợp lệ.");
      await client`drop schema ${client(scope)} cascade`;
      const [remaining] = await client`select count(*)::int as total from pg_namespace where nspname=${scope}`;
      assert.equal(remaining.total, 0);
      console.log("Đã dọn schema kiểm thử riêng.");
    }
    await client.end({ timeout: 10 });
  }
}
main().catch(() => { console.error(`Kiểm thử tham chiếu ảnh SEO chưa đạt tại bước ${phase}; không in dữ liệu hoặc kết nối.`); process.exitCode = 1; });
