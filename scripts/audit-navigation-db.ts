import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/core/src/db/schema";
import { NavigationWriteConflictError, writeNavigation } from "../packages/core/src/server/navigation/navigation.repository";
import type { NavigationItems } from "../packages/core/src/server/navigation/navigation.contract";

config({ quiet: true });
const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Audit Menu chỉ chạy PostgreSQL local.");
const scope = `cms_menu_audit_${randomUUID().replaceAll("-", "")}`;
const control = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
const clients = [0, 1].map(() => postgres(url, { max: 1, prepare: false, onnotice: () => undefined }));
const databases = clients.map(client => drizzle({ client, schema }));
let created = false;
async function main() {
  try {
    await control`create schema ${control(scope)}`;
    created = true;
    for (const table of ["users", "menus", "menu_items", "menu_revisions", "audit_logs"]) await control`create table ${control(scope)}.${control(table)} (like public.${control(table)} including all)`;
    for (const client of clients) {
      await client`select set_config('search_path', ${scope}, false)`;
      await client`select set_config('statement_timeout', '8000', false)`;
      const [current] = await client`select current_schema() as name`;
      assert.equal(current.name, scope);
    }
    await clients[0]`alter table menu_items add foreign key (menu_id) references menus(id) on delete cascade`;
    await clients[0]`alter table menu_items add foreign key (parent_id) references menu_items(id) on delete cascade`;
    await clients[0]`alter table menu_revisions add foreign key (menu_id) references menus(id) on delete cascade`;
    await clients[0]`alter table menu_revisions add foreign key (editor_id) references users(id) on delete set null`;
    await clients[0]`alter table audit_logs add foreign key (user_id) references users(id) on delete set null`;
    const items: NavigationItems = [{ key: "parent", parentKey: null, label: "Cha", url: "/", linkType: "custom", contentId: null, target: "_self", isEnabled: true }, { key: "child", parentKey: "parent", label: "Con", url: "/lien-he", linkType: "custom", contentId: null, target: "_self", isEnabled: true }];
    const input = { location: "header" as const, name: "Menu kiểm thử", items, userId: randomUUID(), expectedVersion: 0, changeNote: "Fixture riêng" };
    await clients[0]`insert into users (id, username, full_name, password_hash) values (${input.userId}, 'menu_fixture', 'Người kiểm thử', 'khong-phai-hash-dang-nhap')`;
    const first = await writeNavigation(input, databases[0]);
    assert.equal(first.version, 1);
    assert.equal(first.items[1].parentKey, first.items[0].key);
    assert.notEqual(first.items[0].key, "parent");
    const outcomes = await Promise.allSettled([
      writeNavigation({ ...input, items: first.items, expectedVersion: 1 }, databases[0]),
      writeNavigation({ ...input, items: first.items, expectedVersion: 1 }, databases[1]),
    ]);
    assert.equal(outcomes.filter(row => row.status === "fulfilled").length, 1);
    const rejected = outcomes.find(row => row.status === "rejected");
    assert.ok(rejected?.status === "rejected" && rejected.reason instanceof NavigationWriteConflictError);
    const next = await writeNavigation({ ...input, items: [first.items[0]], expectedVersion: 2 }, databases[0]);
    assert.equal(next.id, first.id);
    assert.equal(next.items[0].key, first.items[0].key);
    assert.equal(next.version, 3);
    const [rows] = await clients[0]`select count(*)::int as total from menu_items`;
    assert.equal(rows.total, 1);
    const [history] = await clients[0]`select (select count(*)::int from menu_revisions) as revisions, (select count(*)::int from audit_logs) as audits`;
    assert.deepEqual(history, { revisions: 3, audits: 3 });
    console.log("Đạt: Menu tạo ID/quan hệ cha-con, update giữ ID, xóa con và hai writer cùng version chỉ một ghi; revision/audit đúng.");
    const siblings = await writeNavigation({ ...input, items: [next.items[0], { ...items[1], key: "one", parentKey: next.items[0].key }, { ...items[1], key: "two", parentKey: next.items[0].key }], expectedVersion: 3 }, databases[0]);
    const reordered = await writeNavigation({ ...input, items: [siblings.items[0], siblings.items[2], siblings.items[1]], expectedVersion: 4 }, databases[0]);
    assert.deepEqual(reordered.items.map(item => item.key), [siblings.items[0].key, siblings.items[2].key, siblings.items[1].key]);
    const promoted = await writeNavigation({ ...input, items: [{ ...reordered.items[1], parentKey: null }], expectedVersion: 5 }, databases[0]);
    assert.equal(promoted.items[0].key, siblings.items[2].key);
    const persisted = await clients[0]`select id, parent_id, sort_order from menu_items`;
    assert.deepEqual(Array.from(persisted), [{ id: siblings.items[2].key, parent_id: null, sort_order: 0 }]);
    const [finalHistory] = await clients[0]`select (select count(*)::int from menu_revisions) as revisions, (select count(*)::int from audit_logs) as audits`;
    assert.deepEqual(finalHistory, { revisions: 6, audits: 6 });
    console.log("Đạt: dưới FK thật trong schema riêng, đổi thứ tự anh em không xung đột index; giữ con lên cấp cao khi bỏ cha không bị cascade mất.");
    await clients[0]`alter table audit_logs add constraint reject_menu_audit check (action <> 'navigation.update') not valid`;
    await assert.rejects(writeNavigation({ ...input, items: [], expectedVersion: 6 }, databases[0]));
    const afterFailure = await clients[0]`select id, parent_id, sort_order from menu_items`;
    assert.deepEqual(Array.from(afterFailure), Array.from(persisted));
    const [versionAfterFailure] = await clients[0]`select version from menus where id=${first.id}`;
    assert.equal(versionAfterFailure.version, 6);
    const [countsAfterFailure] = await clients[0]`select (select count(*)::int from menu_revisions) as revisions, (select count(*)::int from audit_logs) as audits`;
    assert.deepEqual(countsAfterFailure, finalHistory);
    await clients[0]`alter table audit_logs drop constraint reject_menu_audit`;
    console.log("Đạt: audit lỗi rollback xóa mục/version/revision; cây menu trước request giữ nguyên.");
  } catch {
    console.error("Audit Menu DB thất bại; kiểm tra schema local/assertion, không in SQL/dữ liệu.");
    process.exitCode = 1;
  } finally {
    await Promise.all(clients.map(client => client.end({ timeout: 10 })));
    if (created) {
      if (!/^cms_menu_audit_[a-f0-9]{32}$/.test(scope)) throw new Error("Schema kiểm thử không hợp lệ.");
      await control`drop schema ${control(scope)} cascade`;
      const [remaining] = await control`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`;
      assert.equal(remaining.total, 0);
      console.log("Đã dọn schema Menu kiểm thử; không thay public.");
    }
    await control.end({ timeout: 10 });
  }
}
void main().catch(() => { console.error("Không hoàn tất dọn dẹp audit Menu local."); process.exitCode = 1; });
