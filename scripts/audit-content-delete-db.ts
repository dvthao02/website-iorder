import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/core/src/db/schema";
import { deleteArchivedPost } from "../packages/core/src/server/posts/posts.repository";
import { deleteArchivedOffering } from "../packages/core/src/server/offerings/offerings.repository";
import { ContentVersionConflictError } from "../packages/core/src/server/shared/content-version";

config({ quiet: true });
const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Audit xóa chỉ chạy PostgreSQL local.");
const scope = `cms_delete_audit_${randomUUID().replaceAll("-", "")}`;
const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
const db = drizzle({ client, schema });
const writer = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
let created = false;
let stage = "tạo cấu trúc";

async function main() {
  try {
    await client`create schema ${client(scope)}`;
    created = true;
    for (const table of ["posts", "offerings", "audit_logs"]) await client`create table ${client(scope)}.${client(table)} (like public.${client(table)} including all)`;
    await client`select set_config('search_path', ${scope}, false)`;
    const [current] = await client`select current_schema() as name`;
    assert.equal(current.name, scope);
    await writer`select set_config('search_path', ${scope}, false)`;
    const [writerScope] = await writer`select current_schema() as name`;
    assert.equal(writerScope.name, scope);
    const [reader] = await client`select pg_backend_pid() as pid`;
    const editor = randomUUID();
    for (const [table, remove, action] of [["posts", deleteArchivedPost, "post.delete"], ["offerings", deleteArchivedOffering, "offering.delete"]] as const) {
      stage = `kiểm ${table}`;
      const id = randomUUID();
      await client`insert into ${client(table)} (id,type,title,slug,content,status,draft_version) values (${id},${table === "posts" ? "news" : "software"},'Nội dung kiểm thử',${id},'{}','archived',3)`;
      await assert.rejects(remove(id, editor, 2, db), ContentVersionConflictError);
      const [unchanged] = await client`select deleted_at from ${client(table)} where id=${id}`;
      assert.equal(unchanged.deleted_at, null);
      const [noAudit] = await client`select count(*)::int as total from audit_logs where entity_id=${id}`;
      assert.equal(noAudit.total, 0);

      stage = `rollback audit ${table}`;
      if (table === "posts") await client`alter table audit_logs add constraint fixture_reject_delete check (action <> 'post.delete')`;
      else await client`alter table audit_logs add constraint fixture_reject_delete check (action <> 'offering.delete')`;
      await assert.rejects(remove(id, editor, 3, db));
      const [rolledBack] = await client`select deleted_at from ${client(table)} where id=${id}`;
      assert.equal(rolledBack.deleted_at, null);
      const [rolledBackAudit] = await client`select count(*)::int as total from audit_logs where entity_id=${id}`;
      assert.equal(rolledBackAudit.total, 0);
      await client`alter table audit_logs drop constraint fixture_reject_delete`;

      stage = `xóa hợp lệ ${table}`;
      const result = await remove(id, editor, 3, db);
      assert.equal(result?.id, id);
      const [deleted] = await client`select deleted_at from ${client(table)} where id=${id}`;
      assert.ok(deleted.deleted_at);
      const logs = await client`select action,user_id,before_data from audit_logs where entity_id=${id}`;
      assert.equal(logs.length, 1);
      assert.equal(logs[0].action, action);
      assert.equal(logs[0].user_id, editor);
      assert.equal(logs[0].before_data.draftVersion, 3);
      assert.equal(await remove(id, editor, 3, db), undefined);
      const [once] = await client`select count(*)::int as total from audit_logs where entity_id=${id}`;
      assert.equal(once.total, 1);
      console.log(`${table}: version cũ bị chặn; audit lỗi rollback; xóa hợp lệ ghi đúng actor/baseline, không ghi lặp.`);

      stage = `writer cạnh tranh ${table}`;
      const raceId = randomUUID();
      await client`insert into ${client(table)} (id,type,title,slug,content,status,draft_version) values (${raceId},${table === "posts" ? "news" : "software"},'Bản trước sửa',${raceId},'{}','archived',3)`;
      let deletion: Promise<{ error?: unknown; result?: unknown }> | undefined;
      await writer.begin(async tx => {
        await tx`update ${tx(table)} set draft_version=4,title='Bản mới ở phiên khác' where id=${raceId}`;
        deletion = remove(raceId, editor, 3, db).then(result => ({ result }), error => ({ error }));
        let waiting = false;
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          const [activity] = await tx`select wait_event_type from pg_stat_activity where pid=${reader.pid}`;
          if (activity?.wait_event_type === "Lock") { waiting = true; break; }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(waiting, true, "Yêu cầu xóa phải đang chờ khóa của writer thật.");
      });
      assert.ok(deletion);
      const outcome = await deletion;
      assert.ok(outcome.error instanceof ContentVersionConflictError);
      const [raceRow] = await client`select draft_version,title,deleted_at from ${client(table)} where id=${raceId}`;
      assert.equal(raceRow.draft_version, 4);
      assert.equal(raceRow.title, "Bản mới ở phiên khác");
      assert.equal(raceRow.deleted_at, null);
      const [raceAudit] = await client`select count(*)::int as total from audit_logs where entity_id=${raceId}`;
      assert.equal(raceAudit.total, 0);
      console.log(`${table}: xác nhận chờ khóa writer; sau commit version mới, xóa cũ bị chặn, nội dung mới còn nguyên và không audit xóa.`);
    }
  } catch {
    console.error(`Audit xóa thất bại ở bước: ${stage}.`);
    process.exitCode = 1;
  } finally {
    await writer.end({ timeout: 10 });
    if (created) {
      assert.match(scope, /^cms_delete_audit_[a-f0-9]{32}$/);
      await client`drop schema ${client(scope)} cascade`;
      const [remaining] = await client`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`;
      assert.equal(remaining.total, 0);
      console.log("Đã dọn schema xóa kiểm thử; không thay dữ liệu public.");
    }
    await client.end({ timeout: 10 });
  }
}
void main().catch(() => { console.error("Không hoàn tất dọn audit xóa local."); process.exitCode = 1; });
