import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as schema from "../packages/shared/src/db/schema";
import { saveRedirect, deleteRedirect, redirectMovedContent } from "../packages/shared/src/server/redirects/redirects.repository";
import { hasDatabaseErrorCode } from "../packages/shared/src/server/shared/database-error";

config({ quiet: true });
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Chỉ kiểm thử DB local.");
  const scope = `cms_audit_${randomUUID().replaceAll("-", "")}`;
  const control = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
  const clients = [0, 1].map(() => postgres(url, { max: 1, prepare: false, onnotice: () => undefined }));
  let created = false;
  try {
    await control`create schema ${control(scope)}`;
    created = true;
    for (const table of ["redirects", "audit_logs", "menus", "menu_items", "pages", "page_blocks", "posts", "offerings", "sales_equipment", "site_settings"]) await control`create table ${control(scope)}.${control(table)} (like public.${control(table)} including all)`;
    for (const client of clients) {
      await client`select set_config('search_path', ${scope}, false)`;
      await client`select set_config('statement_timeout', '8000', false)`;
      assert.equal((await client`select current_schema() as name`)[0].name, scope);
    }
    const db = clients.map(client => drizzle({ client, schema }));
    const actor = randomUUID();
    const a = { sourcePath: "/audit-a", destinationPath: "/audit-b", statusCode: 301 as const, isEnabled: true };
    const b = { ...a, sourcePath: "/audit-b", destinationPath: "/audit-a" };
    const outcomes = await Promise.allSettled([saveRedirect(null, a, actor, db[0]), saveRedirect(null, b, actor, db[1])]);
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    const failure = outcomes.find(result => result.status === "rejected");
    assert.ok(failure?.status === "rejected" && failure.reason instanceof z.ZodError);
    const [winner] = await clients[0]`select id, source_path, destination_path from redirects`;
    const winningValues = winner.source_path === a.sourcePath ? a : b;
    const losingValues = winner.source_path === a.sourcePath ? b : a;
    await assert.rejects(saveRedirect(null, winningValues, actor, db[0]), error => hasDatabaseErrorCode(error, "23505"));
    const disabledId = (await saveRedirect(null, { ...losingValues, isEnabled: false }, actor, db[0]))?.id;
    assert.ok(disabledId);
    await assert.rejects(saveRedirect(disabledId, losingValues, actor, db[1]), z.ZodError);
    assert.equal((await clients[0]`select is_enabled from redirects where id=${disabledId}`)[0].is_enabled, false);
    assert.equal(await deleteRedirect(winner.id, actor, db[0]), winner.id);
    assert.equal(await saveRedirect(winner.id, winningValues, actor, db[1]), undefined);
    assert.equal(await deleteRedirect(winner.id, actor, db[1]), undefined);
    assert.equal((await saveRedirect(disabledId, losingValues, actor, db[1]))?.id, disabledId);
    assert.ok(await saveRedirect(null, { ...winningValues, destinationPath: "/audit-end" }, actor, db[0]));
    assert.equal((await clients[0]`select count(*)::int as total from audit_logs`)[0].total, 5);
    console.log("Đạt: hai redirect đối nghịch chỉ một thành công; bật lại gây vòng bị từ chối; trùng nguồn nhận 23505; xóa/sửa ID đã xóa không ghi; nguồn đã xóa được dùng lại; audit đúng năm log.");

    // Đổi slug nội dung đã xuất bản: URL cũ → URL mới, chuyển hướng cũ không thành chuỗi, URL mới không bị chiếm.
    assert.ok(await saveRedirect(null, { sourcePath: "/audit-move-chain", destinationPath: "/audit-move-a", statusCode: 301, isEnabled: true }, actor, db[0]));
    assert.ok(await saveRedirect(null, { sourcePath: "/audit-move-b", destinationPath: "/audit-end", statusCode: 301, isEnabled: true }, actor, db[0]));
    const activeMoves = async () => Object.fromEntries((await clients[0]`select source_path, destination_path from redirects where deleted_at is null and source_path like '/audit-move-%'`).map(row => [row.source_path, row.destination_path]));
    await db[0].transaction(tx => redirectMovedContent(tx, { from: "/audit-move-a", to: "/audit-move-b" }, actor));
    assert.deepEqual(await activeMoves(), { "/audit-move-chain": "/audit-move-b", "/audit-move-a": "/audit-move-b" });
    // Đổi ngược lại tên cũ: không tạo vòng lặp, dòng cũ được tái dùng.
    await db[0].transaction(tx => redirectMovedContent(tx, { from: "/audit-move-b", to: "/audit-move-a" }, actor));
    assert.deepEqual(await activeMoves(), { "/audit-move-chain": "/audit-move-a", "/audit-move-b": "/audit-move-a" });
    // Lỗi sau khi ghi trong cùng transaction (ví dụ lưu nội dung thất bại) thì không còn chuyển hướng nào được thêm.
    await assert.rejects(db[0].transaction(async tx => { await redirectMovedContent(tx, { from: "/audit-move-a", to: "/audit-move-c" }, actor); throw new Error("rollback"); }), /rollback/);
    assert.deepEqual(await activeMoves(), { "/audit-move-chain": "/audit-move-a", "/audit-move-b": "/audit-move-a" });
    console.log("Đạt: đổi slug tạo 301 từ URL cũ, gom chuỗi chuyển hướng, gỡ chuyển hướng chiếm URL mới, đổi ngược không tạo vòng, rollback cùng lần lưu.");

    // Chuyển hướng lưu xong thì liên kết nội dung trỏ tới đường dẫn cũ được đổi sang đích, cùng transaction.
    // Giá trị jsonb gửi dạng chuỗi kèm ép kiểu (kết nối thử không chuẩn bị câu lệnh nên không tự suy ra kiểu cho đối tượng).
    const jsonb = (value: unknown) => clients[0]`${JSON.stringify(value)}::jsonb`;
    const rich = (href: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Xem", marks: [{ type: "link", attrs: { href, target: null } }] }] }] });
    const [menu] = await clients[0]`insert into menus (name, location) values ('Audit', 'audit-link') returning id`;
    let menuOrder = 0;
    const menuItem = (label: string, url: string, linkType = "custom") => clients[0]`insert into menu_items (menu_id, label, url, link_type, sort_order) values (${menu.id}, ${label}, ${url}, ${linkType}, ${menuOrder++})`;
    await menuItem("a", "/audit-link-old"); await menuItem("b", "/audit-link-old?x=1"); await menuItem("c", "/audit-link-other"); await menuItem("d", "/audit-link-old", "page");
    const [pageOne] = await clients[0]`insert into pages (title, slug) values ('P1', 'audit-link-p1') returning id`;
    const [pageTwo] = await clients[0]`insert into pages (title, slug) values ('P2', 'audit-link-p2') returning id`;
    const pageBlock = (pageId: string, order: number, data: unknown) => clients[0]`insert into page_blocks (page_id, type, sort_order, data) values (${pageId}, 'hero', ${order}, ${jsonb(data)})`;
    await pageBlock(pageOne.id, 0, { actions: [{ label: "Xem", href: "/audit-link-old" }, { label: "Khác", href: "/audit-link-keep" }], period: "/audit-link-old" });
    await pageBlock(pageTwo.id, 0, { href: "/audit-link-old#neo" });
    const [post] = await clients[0]`insert into posts (type, title, slug, content, cta_url) values ('news', 'B', 'audit-link-b', ${jsonb(rich("/audit-link-old"))}, '/audit-link-old#neo') returning id`;
    await clients[0]`insert into posts (type, title, slug, content, deleted_at) values ('news', 'Đã xóa', 'audit-link-deleted', ${jsonb(rich("/audit-link-old"))}, now())`;
    await clients[0]`insert into offerings (type, title, slug, content) values ('solution', 'O', 'audit-link-o', ${jsonb({ sections: [{ href: "/audit-link-old" }] })})`;
    await clients[0]`insert into sales_equipment (group_id, name, slug, price_vnd, blocks) values (${randomUUID()}, 'E', 'audit-link-e', 1, ${jsonb([{ href: "/audit-link-old" }])})`;
    await clients[0]`insert into site_settings (key, value) values ('consult_popup', ${jsonb({ ctaHref: "/audit-link-old" })}), ('system.backup.history', ${jsonb([{ href: "/audit-link-old" }])})`;
    const versions = async () => (await clients[0]`select (select version from menus where id = ${menu.id}) as menu, (select draft_version from pages where id = ${pageOne.id}) as page_one, (select draft_version from pages where id = ${pageTwo.id}) as page_two, (select draft_version from posts where id = ${post.id}) as post`)[0];
    assert.deepEqual({ ...await versions() }, { menu: 0, page_one: 0, page_two: 0, post: 0 });

    const linkedValues = { sourcePath: "/audit-link-old", destinationPath: "/audit-link-new", statusCode: 301 as const, isEnabled: true };
    const linkedSave = await saveRedirect(null, linkedValues, actor, db[0]);
    assert.ok(linkedSave);
    assert.equal(linkedSave.linkUpdates.links, 9);
    assert.deepEqual(linkedSave.linkUpdates.places.map(place => [place.label, place.items, place.links]), [["Menu", 2, 2], ["Trang website", 2, 2], ["Bài viết", 1, 2], ["Phần mềm, giải pháp, dịch vụ", 1, 1], ["Thiết bị", 1, 1], ["Cấu hình website", 1, 1]]);
    assert.deepEqual((await clients[0]`select label, url from menu_items order by label`).map(row => [row.label, row.url]), [["a", "/audit-link-new"], ["b", "/audit-link-new?x=1"], ["c", "/audit-link-other"], ["d", "/audit-link-old"]]);
    const blocks = Object.fromEntries((await clients[0]`select page_id, data from page_blocks`).map(row => [row.page_id, row.data]));
    assert.deepEqual(blocks[pageOne.id], { actions: [{ label: "Xem", href: "/audit-link-new" }, { label: "Khác", href: "/audit-link-keep" }], period: "/audit-link-old" });
    assert.deepEqual(blocks[pageTwo.id], { href: "/audit-link-new#neo" });
    const [postRow] = await clients[0]`select content, cta_url from posts where id = ${post.id}`;
    assert.equal(JSON.stringify(postRow.content).includes("/audit-link-new"), true);
    assert.equal(JSON.stringify(postRow.content).includes("/audit-link-old"), false);
    assert.equal(postRow.cta_url, "/audit-link-new#neo");
    assert.equal((await clients[0]`select count(*)::int as total from posts where deleted_at is not null and content::text like '%/audit-link-old%'`)[0].total, 1, "bài đã xóa không bị đụng");
    assert.deepEqual((await clients[0]`select key, value from site_settings order by key`).map(row => [row.key, JSON.stringify(row.value)]), [["consult_popup", JSON.stringify({ ctaHref: "/audit-link-new" })], ["system.backup.history", JSON.stringify([{ href: "/audit-link-old" }])]]);
    assert.deepEqual({ ...await versions() }, { menu: 1, page_one: 1, page_two: 1, post: 1 });
    assert.equal((await clients[0]`select count(*)::int as total from audit_logs where action = 'redirect.rewrite_links' and entity_id = ${linkedSave.id}`)[0].total, 1);
    // Lưu lại lần nữa: không còn liên kết nào để đổi, phiên bản không tăng thêm, không ghi nhật ký thừa.
    const again = await saveRedirect(linkedSave.id, linkedValues, actor, db[0], { expectedVersion: 0 });
    assert.equal(again?.linkUpdates.links, 0);
    assert.deepEqual({ ...await versions() }, { menu: 1, page_one: 1, page_two: 1, post: 1 });
    assert.equal((await clients[0]`select count(*)::int as total from audit_logs where action = 'redirect.rewrite_links'`)[0].total, 1);
    console.log("Đạt: lưu chuyển hướng đổi liên kết ở menu (chỉ URL tùy chỉnh), khối trang, bài viết (kể cả nút cuối bài), dịch vụ, thiết bị, cài đặt; bỏ qua bài đã xóa và khóa hệ thống; tăng phiên bản và ghi nhật ký một lần.");

    // Chuyển hướng đang tắt không đổi liên kết; bật lên thì đổi. Đích là đầu một chuỗi thì liên kết trỏ thẳng tới cuối chuỗi.
    await menuItem("e", "/audit-link-off"); await menuItem("f", "/audit-link-chain");
    const off = await saveRedirect(null, { sourcePath: "/audit-link-off", destinationPath: "/audit-link-new", statusCode: 301, isEnabled: false }, actor, db[0]);
    assert.equal(off?.linkUpdates.links, 0);
    assert.equal((await clients[0]`select url from menu_items where label = 'e'`)[0].url, "/audit-link-off");
    assert.equal((await saveRedirect(off!.id, { sourcePath: "/audit-link-off", destinationPath: "/audit-link-new", statusCode: 301, isEnabled: true }, actor, db[0], { expectedVersion: 0 }))?.linkUpdates.links, 1);
    assert.equal((await clients[0]`select url from menu_items where label = 'e'`)[0].url, "/audit-link-new");
    assert.ok(await saveRedirect(null, { sourcePath: "/audit-link-new", destinationPath: "/audit-link-final", statusCode: 301, isEnabled: true }, actor, db[0]));
    assert.equal((await saveRedirect(null, { sourcePath: "/audit-link-chain", destinationPath: "/audit-link-new", statusCode: 301, isEnabled: true }, actor, db[0]))?.linkUpdates.links, 1);
    assert.equal((await clients[0]`select url from menu_items where label = 'f'`)[0].url, "/audit-link-final");
    console.log("Đạt: chuyển hướng tắt không đổi liên kết, bật lại thì đổi; liên kết trỏ thẳng tới đích cuối chuỗi chuyển hướng.");

    // Đổi slug nội dung: liên kết ở nơi khác được đổi, nhưng nội dung đang được lưu (skip) không bị tăng phiên bản lần hai.
    await menuItem("g", "/audit-link-moved");
    await pageBlock(pageOne.id, 1, { href: "/audit-link-moved" });
    await pageBlock(pageTwo.id, 1, { href: "/audit-link-moved" });
    const beforeMove = { ...await versions() };
    const moved = await db[0].transaction(tx => redirectMovedContent(tx, { from: "/audit-link-moved", to: "/audit-link-moved-to" }, actor, { kind: "page", id: pageOne.id }));
    assert.deepEqual(moved.places.map(place => [place.label, place.items]), [["Menu", 1], ["Trang website", 1]]);
    assert.deepEqual({ ...await versions() }, { ...beforeMove, menu: beforeMove.menu + 1, page_two: beforeMove.page_two + 1 });
    assert.equal((await clients[0]`select data from page_blocks where page_id = ${pageOne.id} and sort_order = 1`)[0].data.href, "/audit-link-moved", "trang đang lưu không bị đụng");
    // Hoàn tác cùng lần lưu: lỗi sau khi đổi liên kết thì liên kết về như cũ.
    await assert.rejects(db[0].transaction(async tx => { await redirectMovedContent(tx, { from: "/audit-link-moved-to", to: "/audit-link-moved-back" }, actor); throw new Error("rollback"); }), /rollback/);
    assert.equal((await clients[0]`select url from menu_items where label = 'g'`)[0].url, "/audit-link-moved-to");
    console.log("Đạt: đổi slug đổi liên kết ở nội dung khác, bỏ qua nội dung đang lưu, hoàn tác cùng transaction.");

    // Chuyển hướng quay về chính nó qua địa chỉ tiếng Anh có sẵn của website bị từ chối.
    await assert.rejects(saveRedirect(null, { sourcePath: "/privacy-policy", destinationPath: "/chinh-sach-bao-mat", statusCode: 301, isEnabled: true }, actor, db[0]), z.ZodError);
    console.log("Đạt: /privacy-policy → /chinh-sach-bao-mat bị từ chối vì tạo vòng lặp với chuyển hướng có sẵn của website.");
  } finally {
    await Promise.all(clients.map(client => client.end({ timeout: 10 })));
    try {
      if (created) {
        assert.match(scope, /^cms_audit_[a-f0-9]{32}$/);
        await control`drop schema ${control(scope)} cascade`;
        assert.equal((await control`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`)[0].total, 0);
        console.log("Đã dọn schema thử redirect; không sửa dữ liệu CMS public.");
      }
    } finally { await control.end({ timeout: 10 }); }
  }
}
main().catch(() => { console.error("Kiểm thử DB redirect không đạt; không in kết nối hoặc dữ liệu nhạy cảm."); process.exitCode = 1; });
