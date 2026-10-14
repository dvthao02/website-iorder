import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/core/src/db/schema";
import { listAdminPostsPage, listAdminPostSummariesPage } from "../packages/core/src/server/posts/posts.repository";
import { adminPostListItemSchema } from "../packages/core/src/server/posts/posts.contract";
import { listAdminOfferingsPage, listAdminOfferingSummariesPage } from "../packages/core/src/server/offerings/offerings.repository";
import { adminOfferingListItemSchema } from "../packages/core/src/server/offerings/offering-content.contract";

config({ quiet: true });
const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Audit danh sách chỉ chạy PostgreSQL local.");
const scope = `cms_lists_audit_${randomUUID().replaceAll("-", "")}`;
const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
const db = drizzle({ client, schema });
const writer = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
let created = false;
let stage = "tạo cấu trúc";

// Pause the real query after its rows resolve; commit a separate connection's
// write before the repository continues to count/hydrate in the same transaction.
function databaseWithWriteAfterRows(write: () => Promise<void>) {
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
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
  return new Proxy(db, {
    get(target, key) {
      if (key !== "transaction") return Reflect.get(target, key);
      return (callback: (tx: Transaction) => Promise<unknown>, options: Parameters<typeof db.transaction>[1]) =>
        target.transaction(tx => callback(new Proxy(tx, {
          get(transaction, property) {
            if (property === "select") return (...args: unknown[]) => intercept(Reflect.apply(transaction.select, transaction, args));
            return Reflect.get(transaction, property);
          },
        })), options);
    },
  });
}

async function main() {
  try {
    await client`create schema ${client(scope)}`;
    created = true;
    for (const table of ["posts", "offerings", "categories", "tags", "post_categories", "post_tags"]) {
      await client`create table ${client(scope)}.${client(table)} (like public.${client(table)} including all)`;
    }
    await client`select set_config('search_path', ${scope}, false)`;
    const [current] = await client`select current_schema() as name`;
    assert.equal(current.name, scope);
    const category = randomUUID(), tag = randomUUID();
    stage = "tạo taxonomy";
    await client`insert into categories (id,name,slug) values (${category},'Nhóm kiểm thử','nhom-kiem-thu')`;
    await client`insert into tags (id,name,slug) values (${tag},'Thẻ kiểm thử','the-kiem-thu')`;
    const stamp = "2026-10-10T00:00:00Z";
    for (let index = 0; index < 8; index++) {
      stage = "tạo nội dung";
      const id = randomUUID();
      const status = index < 4 ? "draft" : "archived";
      const title = `Nội dung 100%_${index}`;
      await client`insert into posts (id,type,title,slug,content,status,created_at,updated_at) values (${id},${index < 6 ? "news" : "guide"},${title},${`post-${index}`},'{}',${status},${stamp},${stamp})`;
      await client`insert into post_categories (post_id,category_id) values (${id},${category})`;
      await client`insert into post_tags (post_id,tag_id) values (${id},${tag})`;
      await client`insert into offerings (type,title,slug,content,status,created_at,updated_at) values (${index < 6 ? "software" : "service"},${title},${`offering-${index}`},'{}',${status},${stamp},${stamp})`;
    }
    const query = { page: 1, pageSize: 5, query: "" };
    stage = "đọc danh sách";
    const posts = await listAdminPostsPage(query, db);
    const postsNext = await listAdminPostsPage({ ...query, page: 2 }, db);
    const offerings = await listAdminOfferingsPage(query, db);
    const offeringsNext = await listAdminOfferingsPage({ ...query, page: 2 }, db);
    for (const [first, second] of [[posts, postsNext], [offerings, offeringsNext]]) {
      stage = "kiểm phân trang";
      assert.equal(first.total, 8); assert.equal(first.totalPages, 2);
      assert.equal(first.items.length, 5); assert.equal(second.items.length, 3);
      assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 8);
    }
    const ids = await client`select id from posts order by updated_at desc,created_at desc,id asc`;
    stage = "kiểm thứ tự và taxonomy";
    assert.deepEqual([...posts.items, ...postsNext.items].map(item => item.id), ids.map(row => row.id));
    for (const item of [...posts.items, ...postsNext.items]) {
      assert.deepEqual(item.categoryIds, [category]); assert.deepEqual(item.tagIds, [tag]);
    }
    assert.equal((await listAdminPostsPage({ ...query, type: "news" }, db)).total, 6);
    stage = "kiểm bộ lọc";
    assert.equal((await listAdminPostsPage({ ...query, excludeType: "news" }, db)).total, 2);
    assert.equal((await listAdminOfferingsPage({ ...query, type: "software" }, db)).total, 6);
    for (const list of [listAdminPostsPage, listAdminOfferingsPage]) {
      assert.equal((await list({ ...query, status: "draft" }, db)).total, 4);
      assert.equal((await list({ ...query, query: "%_" }, db)).total, 8);
      assert.equal((await list({ ...query, query: "__" }, db)).total, 0);
      assert.equal((await list({ ...query, page: 3 }, db)).items.length, 0);
    }
    stage = "kiểm writer giữa rows và count";
    await writer`select set_config('search_path', ${scope}, false)`;
    const [writerScope] = await writer`select current_schema() as name`;
    assert.equal(writerScope.name, scope);
    let writes = 0;
    const postSnapshot = await listAdminPostsPage(query, databaseWithWriteAfterRows(async () => {
      await writer.begin(async tx => {
        await tx`update posts set deleted_at=now() where id=${posts.items[0].id}`;
        await tx`update categories set name='Nhóm sau cập nhật' where id=${category}`;
      });
      writes++;
    }));
    assert.equal(writes, 1); assert.equal(postSnapshot.total, 8);
    assert.deepEqual(postSnapshot.items.map(item => item.id), posts.items.map(item => item.id));
    assert.ok(postSnapshot.items.every(item => item.categories[0].name === "Nhóm kiểm thử"));
    const freshPosts = await listAdminPostsPage(query, db);
    assert.equal(freshPosts.total, 7);
    assert.ok(freshPosts.items.every(item => item.categories[0].name === "Nhóm sau cập nhật"));
    const offeringSnapshot = await listAdminOfferingsPage(query, databaseWithWriteAfterRows(async () => {
      await writer`update offerings set deleted_at=now() where id=${offerings.items[0].id}`;
      writes++;
    }));
    assert.equal(writes, 2); assert.equal(offeringSnapshot.total, 8);
    assert.deepEqual(offeringSnapshot.items.map(item => item.id), offerings.items.map(item => item.id));
    assert.equal((await listAdminOfferingsPage(query, db)).total, 7);
    stage = "đo payload nội dung lớn";
    const largeText = "Nội dung kiểm thử. ".repeat(5000);
    await client`update posts set content=${JSON.stringify({ blocks: [{ type: "paragraph", text: largeText }] })}::jsonb`;
    await client`update offerings set content=${JSON.stringify({ fixtureText: largeText })}::jsonb`;
    for (const [label, list] of [["Posts", listAdminPostsPage], ["Offerings", listAdminOfferingsPage]] as const) {
      const started = performance.now();
      const result = await list({ ...query, pageSize: 25 }, db);
      const elapsed = Math.round(performance.now() - started);
      const bytes = Buffer.byteLength(JSON.stringify(result), "utf8");
      const withoutContent = Buffer.byteLength(JSON.stringify({ ...result, items: result.items.map(item => {
        const summary = { ...item };
        Reflect.deleteProperty(summary, "content");
        return summary;
      }) }), "utf8");
      assert.equal(result.items.length, 7);
      assert.ok(bytes > withoutContent * 10);
      console.log(`${label}: fixture 7 mục nội dung lớn, payload ${bytes} byte; không content ${withoutContent} byte; một lượt DB ${elapsed} ms (không phải benchmark production).`);
    }
    console.log("Đạt: Posts/Offerings phân trang 5/3, filter/count, literal wildcard; Posts taxonomy và ID tie-break đúng.");
    const summary = await listAdminPostSummariesPage({ ...query, pageSize: 25 }, db);
    adminPostListItemSchema.array().parse(summary.items);
    assert.equal(summary.total, 7);
    assert.ok(summary.items.every(item => !Object.hasOwn(item, "content") && !Object.hasOwn(item, "categoryIds")));
    const full = await listAdminPostsPage({ ...query, pageSize: 25 }, db);
    assert.deepEqual(summary.items.map(item => item.id), full.items.map(item => item.id));
    const summaryBytes = Buffer.byteLength(JSON.stringify(summary), "utf8");
    assert.ok(summaryBytes < Buffer.byteLength(JSON.stringify(full), "utf8") / 100);
    console.log(`Posts summary thực: ${summaryBytes} byte, đúng ID/thứ tự/count; không content/taxonomy.`);
    const offeringSummary = await listAdminOfferingSummariesPage({ ...query, pageSize: 25 }, db);
    adminOfferingListItemSchema.array().parse(offeringSummary.items);
    const fullOfferings = await listAdminOfferingsPage({ ...query, pageSize: 25 }, db);
    assert.equal(offeringSummary.total, 7);
    assert.deepEqual(offeringSummary.items.map(item => item.id), fullOfferings.items.map(item => item.id));
    assert.ok(offeringSummary.items.every(item => !Object.hasOwn(item, "content")));
    const offeringSummaryBytes = Buffer.byteLength(JSON.stringify(offeringSummary), "utf8");
    assert.ok(offeringSummaryBytes < Buffer.byteLength(JSON.stringify(fullOfferings), "utf8") / 100);
    assert.equal((await listAdminOfferingSummariesPage({ ...query, type: "service" }, db)).total, 2);
    assert.equal((await listAdminOfferingSummariesPage({ ...query, query: "__" }, db)).total, 0);
    console.log(`Offerings summary thực: ${offeringSummaryBytes} byte, đúng ID/thứ tự/count/filter; không content.`);
    stage = "kiểm summary với writer cạnh tranh";
    const postSummarySnapshot = await listAdminPostSummariesPage({ ...query, pageSize: 25 }, databaseWithWriteAfterRows(async () => {
      await writer`update posts set deleted_at=now() where id=${summary.items[0].id}`;
      writes++;
    }));
    assert.equal(writes, 3);
    assert.equal(postSummarySnapshot.total, 7);
    assert.deepEqual(postSummarySnapshot.items.map(item => item.id), summary.items.map(item => item.id));
    assert.equal((await listAdminPostSummariesPage(query, db)).total, 6);
    const offeringSummarySnapshot = await listAdminOfferingSummariesPage({ ...query, pageSize: 25 }, databaseWithWriteAfterRows(async () => {
      await writer`update offerings set deleted_at=now() where id=${offeringSummary.items[0].id}`;
      writes++;
    }));
    assert.equal(writes, 4);
    assert.equal(offeringSummarySnapshot.total, 7);
    assert.deepEqual(offeringSummarySnapshot.items.map(item => item.id), offeringSummary.items.map(item => item.id));
    assert.equal((await listAdminOfferingSummariesPage(query, db)).total, 6);
    console.log("Đạt: cả hai summary giữ rows/count 7 mục khi writer commit giữa truy vấn; request mới thấy 6 mục.");
    console.log("Đạt: writer commit giữa rows/count không đổi snapshot response; request kế tiếp thấy tổng mới và taxonomy mới.");
  } catch (error) {
    console.error(`Audit danh sách DB thất bại ở bước ${stage}; không in SQL hoặc dữ liệu nhạy cảm.`);
    if (error instanceof assert.AssertionError) console.error(`Kiểm định thất bại: ${error.operator}; actual=${typeof error.actual === "number" ? error.actual : "không phải số"}; expected=${typeof error.expected === "number" ? error.expected : "không phải số"}.`);
    if (error instanceof postgres.PostgresError) console.error(`Mã PostgreSQL: ${error.code}; cột: ${error.column_name ?? "không có"}.`);
    process.exitCode = 1;
  } finally {
    await writer.end({ timeout: 10 });
    if (created) {
      if (!/^cms_lists_audit_[a-f0-9]{32}$/.test(scope)) throw new Error("Schema kiểm thử không hợp lệ.");
      await client`drop schema ${client(scope)} cascade`;
      const [remaining] = await client`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`;
      assert.equal(remaining.total, 0);
      console.log("Đã dọn schema danh sách kiểm thử; không thay public.");
    }
    await client.end({ timeout: 10 });
  }
}
void main().catch(() => { console.error("Không hoàn tất dọn audit danh sách local."); process.exitCode = 1; });
