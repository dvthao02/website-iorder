import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as schema from "../packages/core/src/db/schema";
import { listCmsUsers, listCmsUsersPage, writeCmsUser } from "../packages/core/src/server/users/users.repository";
import { cmsUserListQuerySchema } from "../packages/core/src/server/users/users.contract";
import { findActiveAdministratorByUsername, findActiveAdministratorSession } from "../packages/core/src/server/auth/auth.repository";
import { hasDatabaseErrorCode } from "../packages/core/src/server/shared/database-error";
import { CmsAccessError } from "../packages/core/src/server/roles/roles.errors";

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
    for (const table of ["users", "roles", "permissions", "role_permissions", "user_roles", "sessions", "audit_logs"]) {
      await control`create table ${control(scope)}.${control(table)} (like public.${control(table)} including all)`;
    }
    for (const client of clients) {
      await client`select set_config('search_path', ${scope}, false)`;
      await client`select set_config('statement_timeout', '8000', false)`;
      const [current] = await client`select current_schema() as name`;
      assert.equal(current.name, scope);
    }
    await clients[0]`insert into roles (code, name) values ('admin', 'Quản trị thử'), ('editor', 'Biên tập thử')`;
    const db = clients.map((client) => drizzle({ client, schema }));
    let actor: string = randomUUID();
    const base = { email: null, fullName: "Tài khoản thử", status: "active" as const, role: "admin" as const, passwordHash: "fixture-khong-phai-mat-khau-that" };
    // Bootstrap chỉ trong schema thử, để các mutation dùng actor admin có thật.
    await clients[0]`insert into users (id, username, full_name, status, password_hash) values (${actor}, 'audit-bootstrap', 'Quản trị thử', 'active', ${base.passwordHash})`;
    await clients[0]`insert into user_roles (user_id, role_id) select ${actor}, id from roles where code='admin'`;
    const first = await writeCmsUser(null, { ...base, username: "audit-a" }, actor, db[0]);
    const second = await writeCmsUser(null, { ...base, username: "audit-b" }, actor, db[0]);
    assert.ok(first && second);
    await clients[0]`delete from user_roles where user_id=${actor}`;
    await clients[0]`delete from users where id=${actor}`;
    actor = first;
    await assert.rejects(
      writeCmsUser(null, { ...base, username: "audit-a" }, actor, db[0]),
      error => hasDatabaseErrorCode(error, "23505"),
    );
    await assert.rejects(
      writeCmsUser(second, { ...base, username: "audit-a" }, actor, db[0]),
      error => hasDatabaseErrorCode(error, "23505"),
    );
    const [unchanged] = await clients[0]`select username from users where id=${second}`;
    assert.equal(unchanged.username, "audit-b");
    await clients[0]`insert into sessions (user_id, token_hash, expires_at) values
      (${first}, 'fixture-role-a', now() + interval '1 day'),
      (${second}, 'fixture-role-b', now() + interval '1 day')`;
    assert.equal((await findActiveAdministratorSession("fixture-role-a", new Date(), db[0]))?.role, "admin");
    assert.equal((await findActiveAdministratorSession("fixture-role-b", new Date(), db[0]))?.role, "admin");
    const outcomes = await Promise.allSettled([
      writeCmsUser(first, { ...base, username: "audit-a", role: "editor" }, actor, db[0]),
      writeCmsUser(second, { ...base, username: "audit-b", role: "editor" }, actor, db[1]),
    ]);
    assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = outcomes.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected" && (rejected.reason instanceof z.ZodError || rejected.reason instanceof CmsAccessError));
    const [admins] = await clients[0]`select count(*)::int as total from users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id where u.status='active' and r.code='admin'`;
    assert.equal(admins.total, 1);
    const editorId = outcomes[0].status === "fulfilled" ? first : second;
    const editorName = editorId === first ? "audit-a" : "audit-b";
    const adminId = editorId === first ? second : first;
    const adminName = adminId === first ? "audit-a" : "audit-b";
    actor = adminId;
    await assert.rejects(writeCmsUser(null, { ...base, username: "audit-forbidden-editor" }, editorId, db[0]), CmsAccessError);
    await assert.rejects(writeCmsUser(null, { ...base, username: "audit-forbidden-missing" }, randomUUID(), db[0]), CmsAccessError);
    const editorToken = editorId === first ? "fixture-role-a" : "fixture-role-b";
    const adminToken = adminId === first ? "fixture-role-a" : "fixture-role-b";
    assert.equal((await findActiveAdministratorSession(editorToken, new Date(), db[0]))?.role, "editor");
    assert.equal((await findActiveAdministratorSession(adminToken, new Date(), db[0]))?.role, "admin");
    await clients[0]`insert into sessions (user_id, token_hash, expires_at) values
      (${editorId}, 'fixture-editor-session-1', now() + interval '1 day'),
      (${editorId}, 'fixture-editor-session-2', now() + interval '1 day'),
      (${adminId}, 'fixture-admin-session', now() + interval '1 day')`;
    assert.equal((await findActiveAdministratorSession("fixture-editor-session-1", new Date(), db[0]))?.userId, editorId);
    assert.equal((await findActiveAdministratorSession("fixture-admin-session", new Date(), db[0]))?.userId, adminId);
    assert.equal(await findActiveAdministratorSession("fixture-admin-session", new Date(Date.now() + 2 * 86400000), db[0]), undefined);
    assert.equal(await findActiveAdministratorSession("fixture-khong-ton-tai", new Date(), db[0]), undefined);
    await writeCmsUser(editorId, { ...base, username: editorName, role: "editor", status: "disabled" }, actor, db[0]);
    const [revoked] = await clients[0]`select count(*)::int as total, count(*) filter (where revoked_at is not null)::int as revoked from sessions where user_id=${editorId}`;
    assert.equal(revoked.total, 3);
    assert.equal(revoked.revoked, 3);
    await assert.rejects(writeCmsUser(null, { ...base, username: "audit-forbidden-disabled" }, editorId, db[0]), CmsAccessError);
    assert.equal(await findActiveAdministratorSession("fixture-editor-session-1", new Date(), db[0]), undefined);
    // Session chưa revoked vẫn không được nhận khi user disabled.
    await clients[0]`insert into sessions (user_id, token_hash, expires_at) values (${editorId}, 'fixture-disabled-user', now() + interval '1 day')`;
    assert.equal(await findActiveAdministratorSession("fixture-disabled-user", new Date(), db[0]), undefined);
    await clients[0]`insert into sessions (user_id, token_hash, expires_at, revoked_at) values (${adminId}, 'fixture-revoked-admin', now() + interval '1 day', now())`;
    assert.equal(await findActiveAdministratorSession("fixture-revoked-admin", new Date(), db[0]), undefined);
    await assert.rejects(writeCmsUser(adminId, { ...base, username: adminName, status: "disabled" }, actor, db[1]), (error: unknown) => error instanceof z.ZodError || error instanceof CmsAccessError);
    const [retained] = await clients[0]`select u.status, s.revoked_at from users u join sessions s on s.user_id=u.id where u.id=${adminId} and s.token_hash='fixture-admin-session'`;
    assert.equal(retained.status, "active");
    assert.equal(retained.revoked_at, null);
    const [logs] = await clients[0]`select count(*)::int as total, count(*) filter (where before_data ?| array['password','passwordHash'] or after_data ?| array['password','passwordHash'])::int as unsafe from audit_logs`;
    assert.equal(logs.total, 4); // Hai tạo, một hạ quyền, một khóa editor; transaction lỗi không có log.
    assert.equal(logs.unsafe, 0);
    const [forbiddenUsers] = await clients[0]`select count(*)::int as total from users where username like 'audit-forbidden-%'`;
    assert.equal(forbiddenUsers.total, 0);
    console.log("Đạt: actor editor/disabled/không tồn tại bị từ chối tại transaction, không tạo user hoặc audit log.");
    await clients[0]`insert into user_roles (user_id, role_id) select ${adminId}, id from roles where code='editor'`;
    const listed = await listCmsUsers(db[0]);
    assert.equal(listed.length, 2);
    assert.equal(new Set(listed.map(user => user.id)).size, 2);
    assert.deepEqual(listed.map(user => user.username), ["audit-a", "audit-b"]);
    assert.equal(listed.find(user => user.id === adminId)?.role, "admin");
    assert.equal(listed.find(user => user.id === editorId)?.status, "disabled");
    assert.equal(listed.find(user => user.id === editorId)?.role, "editor");
    assert.equal((await findActiveAdministratorByUsername(adminName, db[0]))?.role, "admin");
    assert.equal((await findActiveAdministratorSession(adminToken, new Date(), db[0]))?.role, "admin");
    const [waitingConnection] = await clients[1]`select pg_backend_pid() as pid`;
    const [holdingConnection] = await clients[0]`select pg_backend_pid() as pid`;
    await clients[0]`begin`;
    let committed = false;
    let pendingWrite: Promise<PromiseSettledResult<string | undefined>> | undefined;
    try {
      await clients[0]`select id from roles where code='admin' for update`;
      await clients[0]`delete from user_roles where user_id=${adminId} and role_id in (select id from roles where code='admin')`;
      pendingWrite = writeCmsUser(null, { ...base, username: "audit-forbidden-waiting" }, adminId, db[1])
        .then(value => ({ status: "fulfilled" as const, value }), reason => ({ status: "rejected" as const, reason }));
      const deadline = Date.now() + 3000;
      let observedWait = false;
      while (Date.now() < deadline) {
        const [activity] = await control`select wait_event_type, pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=${waitingConnection.pid}`;
        if (activity?.wait_event_type === "Lock" && activity.blockers.includes(holdingConnection.pid)) {
          observedWait = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.equal(observedWait, true, "Phải quan sát request chờ đúng connection giữ khóa trước khi commit.");
      await clients[0]`commit`;
      committed = true;
      const result = await pendingWrite;
      assert.ok(result.status === "rejected" && result.reason instanceof CmsAccessError);
      const [afterWaiting] = await clients[0]`select count(*)::int as total from users where username='audit-forbidden-waiting'`;
      assert.equal(afterWaiting.total, 0);
      const [afterWaitingLogs] = await clients[0]`select count(*)::int as total from audit_logs`;
      assert.equal(afterWaitingLogs.total, logs.total);
      console.log("Đạt: quan sát request chờ khóa role qua PostgreSQL; commit hạ quyền rồi request bị từ chối, không tạo user/log.");
    } finally {
      if (!committed) await clients[0]`rollback`;
      await pendingWrite;
    }
    assert.equal((await listCmsUsers(db[0])).find(user => user.id === adminId)?.role, "editor");
    assert.equal((await findActiveAdministratorByUsername(adminName, db[0]))?.role, "editor");
    assert.equal((await findActiveAdministratorSession(adminToken, new Date(), db[0]))?.role, "editor");
    await clients[0]`delete from user_roles where user_id=${adminId}`;
    assert.equal((await listCmsUsers(db[0])).some(user => user.id === adminId), false);
    console.log("Đạt: danh sách mỗi tài khoản một dòng, admin ưu tiên, giữ tài khoản disabled, thứ tự username ổn định và loại tài khoản không có role CMS.");
    assert.equal(await findActiveAdministratorByUsername(adminName, db[0]), undefined);
    assert.equal(await findActiveAdministratorSession(adminToken, new Date(), db[0]), undefined);
    console.log("Đạt: đăng nhập/session ưu tiên admin khi có hai role; đọc editor sau bỏ admin; từ chối khi không còn role CMS.");
    console.log("Đạt: hai giao dịch hạ quyền chỉ một thành công; vẫn còn một admin; khóa editor không bị chặn nhầm; audit không có khóa mật khẩu/hash và không thừa log.");
    console.log("Đạt: session tồn tại đọc role mới sau hạ quyền; khóa editor thu hồi cả ba session; từ chối khóa admin cuối giữ nguyên user/session và không sinh audit log.");
    console.log("Đạt: repository xác thực nhận session active; từ chối token không tồn tại, session hết hạn/revoked và user disabled dù session chưa revoked.");
    console.log("Đạt: trùng tên đăng nhập khi tạo/sửa nhận mã 23505 qua lỗi DB thật; rollback giữ username và không thừa audit.");
    const pageIds = Array.from({ length: 12 }, () => randomUUID());
    for (let index = 0; index < pageIds.length; index++) {
      await clients[0]`insert into users (id, username, full_name, status, password_hash) values (${pageIds[index]}, ${`list-fixture-${String(index).padStart(2, "0")}`}, 'Danh sách 100%_ kiểm thử', ${index < 6 ? "active" : "disabled"}, 'khong-phai-hash-dang-nhap')`;
      await clients[0]`insert into user_roles (user_id, role_id) select ${pageIds[index]}, id from roles where code='editor'`;
      if (index % 2 === 0) await clients[0]`insert into user_roles (user_id, role_id) select ${pageIds[index]}, id from roles where code='admin'`;
    }
    const listQuery = cmsUserListQuerySchema.parse({ query: "list-fixture-", pageSize: 5 });
    const [expectedCounts] = await clients[0]`select count(distinct u.id)::int as all, count(distinct u.id) filter (where u.status='active')::int as active, count(distinct u.id) filter (where u.status='active' and r.code='admin')::int as admins from users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id where r.code in ('admin','editor')`;
    const combined: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const result = await listCmsUsersPage({ ...listQuery, page }, db[0]);
      assert.equal(result.total, 12);
      assert.deepEqual(result.counts, { all: expectedCounts.all, active: expectedCounts.active, admins: expectedCounts.admins });
      assert.equal(result.totalPages, 3);
      assert.equal(result.items.length, page === 3 ? 2 : 5);
      combined.push(...result.items.map(row => row.id));
      for (const row of result.items) assert.equal("passwordHash" in row, false);
    }
    assert.deepEqual(combined, pageIds);
    for (const role of ["admin", "editor"] as const) {
      const result = await listCmsUsersPage({ ...listQuery, role, status: "disabled" }, db[0]);
      assert.equal(result.total, 3);
      assert.ok(result.items.every(row => row.role === role && row.status === "disabled"));
    }
    assert.equal((await listCmsUsersPage({ ...listQuery, query: "%_" }, db[0])).total, 12);
    assert.equal((await listCmsUsersPage({ ...listQuery, query: "__" }, db[0])).total, 0);
    assert.equal((await listCmsUsersPage({ ...listQuery, page: 4 }, db[0])).items.length, 0);
    console.log("Đạt: phân trang Users5/5/2, role tổng hợp không trùng, filter/count/literal wildcard và whitelist.");
  } finally {
    await Promise.all(clients.map((client) => client.end({ timeout: 10 })));
    try {
      if (created) {
        assert.match(scope, /^cms_audit_[a-f0-9]{32}$/);
        await control`drop schema ${control(scope)} cascade`;
        const [remaining] = await control`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`;
        assert.equal(remaining.total, 0);
        console.log("Đã dọn schema thử tài khoản; không sửa dữ liệu CMS public.");
      }
    } finally { await control.end({ timeout: 10 }); }
  }
}

void main().catch((error: unknown) => {
  if (process.env.AUDIT_DEBUG) console.error(error instanceof Error ? error.stack : error);
  console.error("Audit DB tài khoản thất bại; kiểm tra runner/schema local. Không in dữ liệu tài khoản hoặc secret.");
  process.exitCode = 1;
});
