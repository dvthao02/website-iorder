import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/shared/src/db/schema";
import { applyNotificationStates } from "../packages/shared/src/server/dashboard/notification-state";
import { forgetNotificationStates, listNotificationStates, purgeOldNotificationStates, saveNotificationStates } from "../packages/shared/src/server/dashboard/notification-state.repository";

// Kiểm đọc/xóa thông báo của từng người trên bảng admin_notification_states (schema tạm, không đụng dữ liệu public).
config({ quiet: true });
const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Audit trạng thái thông báo chỉ chạy PostgreSQL local.");
const scope = `cms_notifications_audit_${randomUUID().replaceAll("-", "")}`;
const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
const db = drizzle({ client, schema });
let created = false;

async function main() {
  try {
    await client`create schema ${client(scope)}`;
    created = true;
    await client`create table ${client(scope)}.users (like public.users including all)`;
    await client`create table ${client(scope)}.admin_notification_states (like public.admin_notification_states including all)`;
    await client`select set_config('search_path', ${scope}, false)`;
    const [current] = await client`select current_schema() as name`;
    assert.equal(current.name, scope);

    const [lan] = await client`insert into users (username, password_hash, full_name) values ('audit-lan', 'khong-dung', 'Chị Lan') returning id`;
    const [minh] = await client`insert into users (username, password_hash, full_name) values ('audit-minh', 'khong-dung', 'Anh Minh') returning id`;

    // Chưa có gì: mọi thông báo chưa đọc.
    assert.equal((await listNotificationStates(lan.id, db)).size, 0);

    // Đọc và xóa lưu riêng theo người; ghi lại cùng mã thì ghi đè (đọc rồi xóa thì thành "đã xóa", cập nhật dấu hiệu).
    await saveNotificationStates(lan.id, [{ key: "lead-1", fingerprint: "new", state: "read" }, { key: "lead-2", fingerprint: "new", state: "dismissed" }], db);
    await saveNotificationStates(minh.id, [{ key: "lead-1", fingerprint: "new", state: "dismissed" }], db);
    const lanStates = await listNotificationStates(lan.id, db);
    assert.deepEqual([...lanStates.entries()].sort(), [["lead-1", { fingerprint: "new", state: "read" }], ["lead-2", { fingerprint: "new", state: "dismissed" }]]);
    assert.deepEqual([...(await listNotificationStates(minh.id, db)).entries()], [["lead-1", { fingerprint: "new", state: "dismissed" }]]);
    await saveNotificationStates(lan.id, [{ key: "lead-1", fingerprint: "new", state: "dismissed" }], db);
    assert.deepEqual((await listNotificationStates(lan.id, db)).get("lead-1"), { fingerprint: "new", state: "dismissed" });
    await saveNotificationStates(lan.id, [], db);
    const [rows] = await client`select count(*)::int as total from admin_notification_states where user_id = ${lan.id}`;
    assert.equal(rows.total, 2);
    console.log("Đạt: đọc/xóa thông báo lưu riêng theo người, ghi lại cùng mã thì ghi đè, danh sách rỗng không ghi gì.");

    // Áp lên danh sách thông báo: đã xóa thì ẩn, dấu hiệu đổi thì hiện lại chưa đọc.
    const items = [
      { id: "lead-1", label: "A", detail: "", href: "/a", fingerprint: "new" },
      { id: "lead-2", label: "B", detail: "", href: "/b", fingerprint: "overdue" },
      { id: "lead-3", label: "C", detail: "", href: "/c", fingerprint: "new" },
    ];
    assert.deepEqual(applyNotificationStates(items, await listNotificationStates(lan.id, db)).map((item) => [item.id, item.read]), [["lead-2", false], ["lead-3", false]]);
    assert.deepEqual(applyNotificationStates(items, await listNotificationStates(minh.id, db)).map((item) => [item.id, item.read]), [["lead-2", false], ["lead-3", false]]);
    console.log("Đạt: thông báo đã xóa ẩn đúng người; thông báo đổi dấu hiệu (quá hạn) hiện lại chưa đọc dù đã xóa bản cũ.");

    // Bỏ đọc: quên trạng thái, thông báo trở lại như chưa từng đọc; mã không có thì bỏ qua, người khác không bị ảnh hưởng.
    await forgetNotificationStates(lan.id, ["lead-1", "khong-co"], db);
    await forgetNotificationStates(lan.id, [], db);
    assert.deepEqual([...(await listNotificationStates(lan.id, db)).keys()], ["lead-2"]);
    assert.equal((await listNotificationStates(minh.id, db)).size, 1);
    console.log("Đạt: bỏ đọc quên đúng thông báo của đúng người.");

    // Dọn trạng thái cũ hơn 30 ngày của người đang thao tác; trạng thái mới và của người khác giữ nguyên.
    await client`update admin_notification_states set updated_at = now() - interval '31 days' where user_id = ${lan.id} and notification_key = 'lead-2'`;
    await client`update admin_notification_states set updated_at = now() - interval '31 days' where user_id = ${minh.id}`;
    await saveNotificationStates(lan.id, [{ key: "lead-9", fingerprint: "new", state: "read" }], db);
    await purgeOldNotificationStates(lan.id, new Date(), db);
    assert.deepEqual([...(await listNotificationStates(lan.id, db)).keys()], ["lead-9"]);
    assert.equal((await listNotificationStates(minh.id, db)).size, 1);
    console.log("Đạt: dọn trạng thái cũ hơn 30 ngày chỉ của người đang thao tác.");
  } catch (error) {
    console.error("Audit trạng thái thông báo thất bại. Kiểm tra DB local/schema hoặc assertion.");
    if (process.env.AUDIT_DEBUG === "1") console.error(error);
    process.exitCode = 1;
  } finally {
    if (created) {
      if (!/^cms_notifications_audit_[a-f0-9]{32}$/.test(scope)) throw new Error("Schema kiểm thử không hợp lệ.");
      await client`drop schema ${client(scope)} cascade`;
      const [remaining] = await client`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`;
      assert.equal(remaining.total, 0);
      console.log("Đã dọn schema kiểm thử thông báo; không thay dữ liệu public.");
    }
    await client.end({ timeout: 10 });
  }
}
void main().catch(() => { console.error("Không hoàn tất dọn dẹp audit thông báo local."); process.exitCode = 1; });
