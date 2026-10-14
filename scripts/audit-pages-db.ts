import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/core/src/db/schema";
import { deleteArchivedPage, listAdminPagesPage, writePage } from "../packages/core/src/server/pages/pages.repository";
import { pageInputSchema, pageListQuerySchema } from "../packages/core/src/server/pages/pages.contract";
import { PageVersionConflictError } from "../packages/core/src/server/pages/page-version";

config({ quiet: true });
const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Audit Trang chỉ chạy PostgreSQL local.");
const scope = `cms_pages_audit_${randomUUID().replaceAll("-", "")}`;
const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
const db = drizzle({ client, schema });
const writerA = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
const writerB = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
let created = false;
async function main() {
  try {
    await client`create schema ${client(scope)}`;
    created = true;
    for (const table of ["pages", "page_blocks", "page_revisions", "audit_logs", "users"]) await client`create table ${client(scope)}.${client(table)} (like public.${client(table)} including all)`;
    await client`select set_config('search_path', ${scope}, false)`;
    const [current] = await client`select current_schema() as name`;
    assert.equal(current.name, scope);
    await client`alter table page_blocks add constraint fixture_page_fk foreign key (page_id) references pages(id)`;
    await client`alter table page_revisions add constraint fixture_revision_page_fk foreign key (page_id) references pages(id)`;
    await client`alter table page_revisions add constraint fixture_revision_actor_fk foreign key (editor_id) references users(id)`;
    await client`alter table audit_logs add constraint fixture_audit_actor_fk foreign key (user_id) references users(id)`;
    const actor = randomUUID();
    await client`insert into users (id, username, full_name, password_hash) values (${actor}, 'fixture-pages', 'Người kiểm thử', 'khong-phai-hash-dang-nhap')`;
    const values = pageInputSchema.parse({ title: "Trang kiểm thử", slug: "trang-kiem-thu", template: "default", status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null, scheduledAt: null, blocks: [{ type: "rich_text", data: { heading: null, body: "Bản đầu" }, isEnabled: true }] });
    const id = await writePage(null, values, actor, undefined, db);
    assert.ok(id);
    assert.equal(await writePage(id, { ...values, title: "Bản mới", blocks: [{ type: "rich_text", data: { heading: null, body: "Nội dung mới" }, isEnabled: true }] }, actor, 1, db), id);
    for (const version of [1, undefined]) await assert.rejects(writePage(id, { ...values, title: "Ghi đè sai" }, actor, version, db), PageVersionConflictError);
    const [page] = await client`select title, draft_version from pages where id=${id}`;
    const [block] = await client`select data from page_blocks where page_id=${id}`;
    const [revisions] = await client`select count(*)::int as total from page_revisions where page_id=${id}`;
    const [audits] = await client`select count(*)::int as total from audit_logs`;
    assert.equal(page.title, "Bản mới"); assert.equal(page.draft_version, 2);
    assert.equal(block.data.body, "Nội dung mới");
    assert.equal(revisions.total, 2); assert.equal(audits.total, 2);
    await client`alter table audit_logs add constraint reject_fixture_audit check (action <> 'page.update' and action <> 'page.create') not valid`;
    await assert.rejects(writePage(id, { ...values, title: "Lưu lỗi audit" }, actor, 2, db));
    await assert.rejects(writePage(null, { ...values, slug: "tao-loi-audit" }, actor, undefined, db));
    const [afterFailure] = await client`select title, draft_version from pages where id=${id}`;
    const [blockAfterFailure] = await client`select data from page_blocks where page_id=${id}`;
    const [countsAfterFailure] = await client`select (select count(*) from pages)::int as pages, (select count(*) from page_revisions)::int as revisions, (select count(*) from audit_logs)::int as audits`;
    assert.equal(afterFailure.title, "Bản mới"); assert.equal(afterFailure.draft_version, 2);
    assert.equal(blockAfterFailure.data.body, "Nội dung mới");
    assert.deepEqual({ ...countsAfterFailure }, { pages: 1, revisions: 2, audits: 2 });
    await client`alter table audit_logs drop constraint reject_fixture_audit`;
    await assert.rejects(writePage(id, { ...values, title: "Actor không tồn tại" }, randomUUID(), 2, db));
    const [afterMissingActor] = await client`select title, draft_version from pages where id=${id}`;
    assert.equal(afterMissingActor.title, "Bản mới"); assert.equal(afterMissingActor.draft_version, 2);
    for (const writer of [writerA, writerB]) {
      await writer`select set_config('search_path', ${scope}, false)`;
      const [writerScope] = await writer`select current_schema() as name`;
      assert.equal(writerScope.name, scope);
    }
    const [pidA] = await writerA`select pg_backend_pid() as pid`;
    const [pidB] = await writerB`select pg_backend_pid() as pid`;
    let race: Promise<PromiseSettledResult<string | undefined>[]> | undefined;
    await client.begin(async gate => {
      await gate`select id from pages where id=${id} for update`;
      race = Promise.allSettled([
        writePage(id, { ...values, title: "Writer A" }, actor, 2, drizzle({ client: writerA, schema })),
        writePage(id, { ...values, title: "Writer B" }, actor, 2, drizzle({ client: writerB, schema })),
      ]);
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const [waiting] = await gate`select cardinality(pg_blocking_pids(${pidA.pid})) > 0 and cardinality(pg_blocking_pids(${pidB.pid})) > 0 as both`;
        if (waiting.both) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.ok(blocked, "Hai writer phải thực sự chờ khóa DB.");
    });
    assert.ok(race);
    const results = await race;
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const rejected = results.find(result => result.status === "rejected");
    assert.ok(rejected?.status === "rejected" && rejected.reason instanceof PageVersionConflictError);
    const [afterRace] = await client`select title, draft_version from pages where id=${id}`;
    const [raceCounts] = await client`select (select count(*) from page_revisions)::int as revisions, (select count(*) from audit_logs)::int as audits`;
    assert.ok(["Writer A", "Writer B"].includes(afterRace.title));
    assert.equal(afterRace.draft_version, 3);
    assert.deepEqual({ ...raceCounts }, { revisions: 3, audits: 3 });
    for (let i = 0; i < 7; i++) await writePage(null, { ...values, title: `Trang 100%_ ${i}`, slug: `trang-phan-trang-${i}`, status: i < 4 ? "draft" : "archived" }, actor, undefined, db);
    // Cùng updated_at để buộc kiểm tie-break theo ID, không dựa timing của insert.
    await client`update pages set updated_at='2026-10-10T00:00:00Z'`;
    const input = pageListQuerySchema.parse({ pageSize: 5 });
    const first = await listAdminPagesPage(input, db);
    const second = await listAdminPagesPage({ ...input, page: 2 }, db);
    const expectedRows = await client`select id from pages order by updated_at desc, id asc`;
    assert.equal(first.total, 8); assert.equal(first.totalPages, 2);
    assert.equal(first.items.length, 5); assert.equal(second.items.length, 3);
    assert.deepEqual([...first.items, ...second.items].map(page => page.id), expectedRows.map(page => page.id));
    for (const page of [...first.items, ...second.items]) {
      assert.equal(page.blocks.length, 1);
      assert.deepEqual(page.blocks[0].data, { heading: null, body: "Bản đầu" });
    }
    const archived = await listAdminPagesPage({ ...input, status: "archived" }, db);
    assert.equal(archived.total, 3); assert.ok(archived.items.every(page => page.status === "archived"));
    assert.equal((await listAdminPagesPage({ ...input, query: "%_" }, db)).total, 7);
    assert.equal((await listAdminPagesPage({ ...input, query: "__" }, db)).total, 0);
    assert.equal((await listAdminPagesPage({ ...input, page: 3 }, db)).items.length, 0);
    assert.equal(await deleteArchivedPage(id, actor, db), undefined);
    const archivedId = archived.items[0].id;
    const [beforeDelete] = await client`select count(*)::int as total from audit_logs`;
    await client`alter table audit_logs add constraint reject_fixture_delete check (action <> 'page.delete') not valid`;
    await assert.rejects(deleteArchivedPage(archivedId, actor, db));
    const [failedDelete] = await client`select deleted_at from pages where id=${archivedId}`;
    const [failedDeleteAudit] = await client`select count(*)::int as total from audit_logs`;
    assert.equal(failedDelete.deleted_at, null); assert.equal(failedDeleteAudit.total, beforeDelete.total);
    await client`alter table audit_logs drop constraint reject_fixture_delete`;
    assert.equal((await deleteArchivedPage(archivedId, actor, db))?.id, archivedId);
    assert.equal(await deleteArchivedPage(archivedId, actor, db), undefined);
    assert.equal(await deleteArchivedPage(randomUUID(), actor, db), undefined);
    assert.equal(await writePage(archivedId, values, actor, archived.items[0].draftVersion, db), undefined);
    const [deletedRow] = await client`select deleted_at from pages where id=${archivedId}`;
    assert.ok(deletedRow.deleted_at);
    assert.equal((await listAdminPagesPage(input, db)).total, 7);
    const [deleteAudits] = await client`select count(*)::int as total from audit_logs where action='page.delete'`;
    assert.equal(deleteAudits.total, 1);
    console.log("Đạt: Trang tạo/sửa tăng version; phiên bản cũ/thiếu không ghi đè blocks, revision hoặc audit.");
    console.log("Đạt: lỗi audit rollback tạo/sửa và blocks/revisions; FK actor thiếu không để ghi dở dang.");
    console.log("Đạt: hai kết nối thực sự chờ khóa; chỉ một writer ghi, writer còn lại conflict, revision/audit không lặp.");
    console.log("Đạt: danh sách Trang 5/3 ổn định khi ngày trùng, blocks đúng, lọc/count và literal wildcard.");
    console.log("Đạt: xóa mềm chỉ trang archived, không xóa/sửa lại; lỗi audit xóa rollback, danh sách loại trang đã xóa.");
  } catch {
    console.error("Audit Trang DB thất bại; không in SQL hoặc dữ liệu nhạy cảm."); process.exitCode = 1;
  } finally {
    await writerA.end({ timeout: 10 });
    await writerB.end({ timeout: 10 });
    if (created) {
      if (!/^cms_pages_audit_[a-f0-9]{32}$/.test(scope)) throw new Error("Schema kiểm thử không hợp lệ.");
      await client`drop schema ${client(scope)} cascade`;
      const [remaining] = await client`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`;
      assert.equal(remaining.total, 0);
      console.log("Đã dọn schema Trang kiểm thử; không thay public.");
    }
    await client.end({ timeout: 10 });
  }
}
void main().catch(() => { console.error("Không hoàn tất dọn audit Trang local."); process.exitCode = 1; });
