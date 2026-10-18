import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/core/src/db/schema";
import { cmsPermissions, type CmsPermissionCode } from "../packages/core/src/server/auth/permissions";
import { syncCmsPermissionCatalog } from "../packages/core/src/server/roles/roles.sync";
import { deleteCmsRole, listCmsRoles, writeCmsRole } from "../packages/core/src/server/roles/roles.repository";
import { CmsAccessError } from "../packages/core/src/server/roles/roles.errors";
import { writeCmsUser } from "../packages/core/src/server/users/users.repository";
import { savePartner } from "../packages/core/src/server/supporting/supporting.repository";

config({ quiet: true });

const rejectsWith = (promise: Promise<unknown>, code: string, message?: RegExp) => assert.rejects(promise, (error: unknown) => {
  assert.ok(error instanceof CmsAccessError, `expected CmsAccessError, got ${String(error)}`);
  assert.equal(error.code, code);
  if (message) assert.match(error.message, message);
  return true;
});

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Chỉ kiểm thử DB local.");
  const scope = `cms_roles_audit_${randomUUID().replaceAll("-", "")}`;
  const control = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
  let created = false;
  try {
    await control`create schema ${control(scope)}`;
    created = true;
    for (const table of ["users", "roles", "permissions", "role_permissions", "user_roles", "sessions", "audit_logs", "partners"]) {
      await control`create table ${control(scope)}.${control(table)} (like public.${control(table)} including all)`;
    }
    // Migration 0010 trên bản sao trong schema thử; không đụng public.
    await control`alter table ${control(scope)}.roles add column if not exists description varchar(500), add column if not exists is_system boolean not null default false`;
    await control`alter table ${control(scope)}.role_permissions add foreign key (role_id) references ${control(scope)}.roles(id) on delete cascade, add foreign key (permission_id) references ${control(scope)}.permissions(id) on delete cascade`;
    await control`alter table ${control(scope)}.user_roles add foreign key (role_id) references ${control(scope)}.roles(id) on delete cascade`;
    await client`select set_config('search_path', ${scope}, false)`;
    await client`select set_config('statement_timeout', '8000', false)`;
    const db = drizzle({ client, schema });

    // 1. Nâng cấp từ mã quyền cũ: quyền cũ bị xóa, role mặc định rỗng nhận bộ mới, role tùy chỉnh giữ nguyên.
    const [legacyEditor] = await client`insert into roles (code, name) values ('editor', 'Biên tập cũ') returning id`;
    const [legacyPermission] = await client`insert into permissions (code, name) values ('content.write', 'Quyền cũ') returning id`;
    await client`insert into role_permissions (role_id, permission_id) values (${legacyEditor.id}, ${legacyPermission.id})`;
    // Role tùy chỉnh mang mã cũ: phải nhận quyền tương đương, không bị khóa.
    const [legacyCustom] = await client`insert into roles (code, name) values ('legacy_custom', 'Tùy chỉnh cũ') returning id`;
    const [legacyMedia] = await client`insert into permissions (code, name) values ('media.manage', 'Quyền cũ') returning id`;
    await client`insert into role_permissions (role_id, permission_id) values (${legacyCustom.id}, ${legacyPermission.id}), (${legacyCustom.id}, ${legacyMedia.id})`;
    await db.transaction((tx) => syncCmsPermissionCatalog(tx));
    let roles = await listCmsRoles(db);
    assert.equal((await client`select count(*)::int as n from permissions`)[0].n, cmsPermissions.length);
    assert.equal((await client`select count(*)::int as n from permissions where code = 'content.write'`)[0].n, 0);
    const superAdmin = roles.find((role) => role.code === "admin")!;
    assert.equal(superAdmin.isSystem, true);
    assert.equal(superAdmin.permissions.length, cmsPermissions.length);
    const editor = roles.find((role) => role.code === "editor")!;
    assert.equal(editor.name, "Biên tập cũ", "không ghi đè tên role đã có");
    assert.ok(editor.permissions.includes("posts.update") && !editor.permissions.some((code) => code.endsWith(".publish")));
    assert.equal(roles.length, 8);
    const custom = roles.find((role) => role.code === "legacy_custom")!;
    assert.ok(["posts.update", "pages.create", "media.view", "media.delete"].every((code) => custom.permissions.includes(code)), "role tùy chỉnh giữ quyền tương đương");
    assert.equal(custom.permissions.some((code) => code.endsWith(".publish") || code.startsWith("users.")), false);
    assert.equal(custom.permissions.some((code) => code.startsWith("taxonomy.")), false, "content.write cũ không được mở rộng sang taxonomy");

    // 2. Role đã chỉnh được giữ khi seed chạy lại.
    await client`delete from role_permissions where role_id = ${editor.id} and permission_id = (select id from permissions where code = 'posts.delete')`;
    const supportRole = roles.find((role) => role.code === "support")!;
    await client`delete from role_permissions where role_id = ${supportRole.id}`;
    await db.transaction((tx) => syncCmsPermissionCatalog(tx));
    roles = await listCmsRoles(db);
    assert.equal(roles.find((role) => role.code === "editor")!.permissions.includes("posts.delete"), false);
    assert.equal(roles.find((role) => role.code === "support")!.permissions.length, 0, "role bị làm trống có chủ đích không được cấp lại");
    assert.equal(roles.find((role) => role.code === "admin")!.permissions.length, cmsPermissions.length);

    // Tài khoản thử.
    const hash = "fixture-khong-phai-mat-khau-that";
    const [owner] = await client`insert into users (username, full_name, password_hash) values ('audit-owner', 'Super Admin thử', ${hash}) returning id`;
    await client`insert into user_roles (user_id, role_id) values (${owner.id}, ${superAdmin.id})`;
    const delegateRoleId = await writeCmsRole(null, { name: "Ủy quyền", description: null, permissions: ["posts.view", "roles.view", "roles.create", "roles.update", "roles.delete", "users.view", "users.create", "users.update"] }, owner.id, db);
    const [delegate] = await client`insert into users (username, full_name, password_hash) values ('audit-delegate', 'Ủy quyền thử', ${hash}) returning id`;
    await client`insert into user_roles (user_id, role_id) values (${delegate.id}, ${delegateRoleId})`;

    // 3. Chống leo thang quyền và bảo vệ role.
    const smallRole = await writeCmsRole(null, { name: "Chỉ xem bài", description: "", permissions: ["posts.view"] }, delegate.id, db);
    await rejectsWith(writeCmsRole(null, { name: "Leo thang", description: null, permissions: ["posts.publish"] }, delegate.id, db), "FORBIDDEN", /không có/);
    await rejectsWith(writeCmsRole(delegateRoleId, { name: "Tự nâng", description: null, permissions: ["posts.view"] }, delegate.id, db), "FORBIDDEN", /chính mình/);
    await rejectsWith(writeCmsRole(superAdmin.id, { name: "Đổi", description: null, permissions: [] }, owner.id, db), "ROLE_PROTECTED");
    await rejectsWith(deleteCmsRole(superAdmin.id, owner.id, db), "ROLE_PROTECTED");
    await rejectsWith(deleteCmsRole(delegateRoleId, owner.id, db), "ROLE_IN_USE");
    // Role có quyền delegate không có: delegate vẫn sửa được tên mà không bị coi là cấp thêm quyền.
    await writeCmsRole(editor.id, { name: "Biên tập", description: null, permissions: [...roles.find((role) => role.code === "editor")!.permissions as CmsPermissionCode[]] }, owner.id, db);
    await rejectsWith(writeCmsRole(editor.id, { name: "Biên tập 2", description: null, permissions: [...roles.find((role) => role.code === "editor")!.permissions as CmsPermissionCode[], "posts.publish"] }, delegate.id, db), "FORBIDDEN");
    await writeCmsRole(editor.id, { name: "Biên tập 2", description: null, permissions: [...roles.find((role) => role.code === "editor")!.permissions as CmsPermissionCode[]] }, delegate.id, db);
    assert.equal((await client`select count(*)::int as n from audit_logs where entity_type = 'role'`)[0].n >= 4, true);

    // 4. Gán role cho tài khoản.
    const userBase = { email: null, fullName: "Người thử", status: "active" as const, passwordHash: hash };
    const memberId = await writeCmsUser(null, { ...userBase, username: "audit-member", role: "role_does_not_matter" }, delegate.id, db).catch((error: unknown) => error);
    assert.ok(memberId instanceof CmsAccessError && memberId.code === "NOT_FOUND");
    const smallCode = (await client`select code from roles where id = ${smallRole}`)[0].code as string;
    const member = await writeCmsUser(null, { ...userBase, username: "audit-member", role: smallCode }, delegate.id, db);
    assert.ok(member);
    await rejectsWith(writeCmsUser(null, { ...userBase, username: "audit-up", role: "admin" }, delegate.id, db), "FORBIDDEN", /Super Admin/);
    await rejectsWith(writeCmsUser(null, { ...userBase, username: "audit-up", role: "content_manager" }, delegate.id, db), "FORBIDDEN", /không có/);
    await rejectsWith(writeCmsUser(owner.id, { ...userBase, username: "audit-owner", role: smallCode }, delegate.id, db), "FORBIDDEN", /Super Admin/);
    await rejectsWith(writeCmsUser(delegate.id, { ...userBase, username: "audit-delegate", role: smallCode }, delegate.id, db), "FORBIDDEN", /chính tài khoản/);
    await rejectsWith(writeCmsUser(owner.id, { ...userBase, username: "audit-owner", role: smallCode }, owner.id, db), "FORBIDDEN", /chính tài khoản/);
    await assert.rejects(writeCmsUser(null, { ...userBase, username: "audit-x", role: smallCode }, member, db), CmsAccessError);

    // 6. Người không có supporting.publish không ghi đè được mục đang hiển thị, kể cả khi trạng thái vừa đổi (điều kiện nằm trong UPDATE).
    const partner = { logoMediaId: null, kind: "partner" as const, name: "Đối tác thử", description: null, websiteUrl: null, sortOrder: 0, isEnabled: true };
    const partnerId = await savePartner(null, partner, owner.id, db);
    assert.ok(partnerId);
    assert.equal(await savePartner(partnerId, { ...partner, name: "Bị gỡ", isEnabled: false }, delegate.id, db, { onlyIfHidden: true }), undefined);
    assert.equal((await client`select name, is_enabled from partners where id = ${partnerId}`)[0].is_enabled, true);
    assert.equal(await savePartner(partnerId, { ...partner, name: "Đã duyệt" }, owner.id, db, { onlyIfHidden: false }), partnerId);

    // 5. Xóa role không còn dùng; số tài khoản theo role đúng.
    roles = await listCmsRoles(db);
    assert.equal(roles.find((role) => role.id === smallRole)!.userCount, 1);
    await client`delete from user_roles where user_id = ${member}`;
    assert.equal(await deleteCmsRole(smallRole, delegate.id, db), smallRole);
    console.log("audit-roles-db: đạt");
  } finally {
    await client.end({ timeout: 10 });
    try {
      if (created) {
        assert.match(scope, /^cms_roles_audit_[0-9a-f]{32}$/);
        await control`drop schema ${control(scope)} cascade`;
      }
    } finally { await control.end({ timeout: 10 }); }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Kiểm thử role thất bại.");
  process.exitCode = 1;
});
