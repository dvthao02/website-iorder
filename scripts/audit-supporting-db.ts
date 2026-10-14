import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/core/src/db/schema";
import { deleteDisabledPartner, deleteDisabledTestimonial, listPartnersPage, listTestimonialsPage, savePartner, saveTestimonial } from "../packages/core/src/server/supporting/supporting.repository";
import { partnerInputSchema, partnerListQuerySchema, testimonialInputSchema, testimonialListQuerySchema } from "../packages/core/src/server/supporting/supporting.contract";

config({ quiet: true });
const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Audit thương hiệu chỉ chạy PostgreSQL local.");
const scope = `cms_supporting_audit_${randomUUID().replaceAll("-", "")}`;
const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
const db = drizzle({ client, schema });
let created = false;
async function main() {
  try {
    await client`create schema ${client(scope)}`;
    created = true;
    for (const table of ["partners", "testimonials", "media_assets", "audit_logs", "users"]) await client`create table ${client(scope)}.${client(table)} (like public.${client(table)} including all)`;
    await client`select set_config('search_path', ${scope}, false)`;
    const [current] = await client`select current_schema() as name`;
    assert.equal(current.name, scope);
    // LIKE INCLUDING ALL không copy FK; thêm rõ vào bảng của schema đã xác minh.
    await client`alter table audit_logs add constraint fixture_audit_user_fk foreign key (user_id) references users(id) on delete set null`;
    await client`alter table partners add constraint fixture_partner_media_fk foreign key (logo_media_id) references media_assets(id) on delete set null`;
    await client`alter table testimonials add constraint fixture_testimonial_media_fk foreign key (avatar_media_id) references media_assets(id) on delete set null`;
    const ids = Array.from({ length: 12 }, () => randomUUID());
    for (let i = 0; i < ids.length; i++) {
      await client`insert into partners (id, name, description, kind, is_enabled) values (${ids[i]}, ${`Đối tác ${String(i).padStart(2, "0")}`}, '100%_ kiểm thử', ${i % 2 ? "partner" : "customer"}, ${i < 6})`;
      await client`insert into testimonials (id, author_name, quote, is_enabled) values (${ids[i]}, 'Tác giả kiểm thử', '100%_ nội dung', ${i < 6})`;
    }
    await client`insert into partners (name, deleted_at) values ('Đã xóa', now())`;
    await client`insert into testimonials (author_name, quote, deleted_at) values ('Đã xóa', 'Nội dung', now())`;
    const partnersQuery = partnerListQuerySchema.parse({ pageSize: 5 });
    const testimonialsQuery = testimonialListQuerySchema.parse({ pageSize: 5 });
    const partnerIds: string[] = [], testimonialIds: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const p = await listPartnersPage({ ...partnersQuery, page }, db);
      const t = await listTestimonialsPage({ ...testimonialsQuery, page }, db);
      for (const result of [p, t]) {
        assert.equal(result.total, 12);
        assert.equal(result.totalPages, 3);
        assert.equal(result.items.length, page === 3 ? 2 : 5);
      }
      partnerIds.push(...p.items.map(row => row.partner.id));
      testimonialIds.push(...t.items.map(row => row.testimonial.id));
    }
    assert.deepEqual(partnerIds, ids);
    assert.deepEqual(testimonialIds, [...ids].sort());
    const filtered = await listPartnersPage({ ...partnersQuery, visibility: "disabled", partnerKind: "customer" }, db);
    assert.equal(filtered.total, 3);
    assert.ok(filtered.items.every(row => !row.partner.isEnabled && row.partner.kind === "customer"));
    assert.equal((await listTestimonialsPage({ ...testimonialsQuery, visibility: "enabled" }, db)).total, 6);
    for (const query of ["%_", "kiểm thử"]) assert.equal((await listPartnersPage({ ...partnersQuery, query }, db)).total, 12);
    assert.equal((await listTestimonialsPage({ ...testimonialsQuery, query: "%_" }, db)).total, 12);
    assert.equal((await listPartnersPage({ ...partnersQuery, query: "__" }, db)).total, 0);
    assert.equal((await listTestimonialsPage({ ...testimonialsQuery, query: "__" }, db)).total, 0);
    assert.equal((await listPartnersPage({ ...partnersQuery, page: 4 }, db)).items.length, 0);
    assert.equal((await listTestimonialsPage({ ...testimonialsQuery, page: 4 }, db)).items.length, 0);
    const actor = randomUUID();
    await client`insert into users (id, username, full_name, password_hash) values (${actor}, 'supporting_fixture', 'Người kiểm thử', 'khong-phai-hash-dang-nhap')`;
    const values = partnerInputSchema.parse({ logoMediaId: null, kind: "partner", name: "  Đối tác CRUD  ", description: "  Mô tả  ", websiteUrl: null, sortOrder: 9, isEnabled: false });
    const createdId = await savePartner(null, values, actor, db);
    assert.ok(createdId);
    const createdPage = await listPartnersPage({ ...partnersQuery, query: "Đối tác CRUD" }, db);
    assert.equal(createdPage.total, 1);
    assert.equal(createdPage.items[0].partner.id, createdId);
    assert.equal(createdPage.items[0].partner.description, "Mô tả");
    assert.equal(await savePartner(createdId, { ...values, name: "Đối tác đã sửa", kind: "customer", sortOrder: 10 }, actor, db), createdId);
    const editedPage = await listPartnersPage({ ...partnersQuery, query: "Đối tác đã sửa", partnerKind: "customer", visibility: "disabled" }, db);
    assert.equal(editedPage.total, 1);
    assert.equal(editedPage.items[0].partner.sortOrder, 10);
    assert.equal(await savePartner(randomUUID(), values, actor, db), undefined);
    const [audits] = await client`select count(*)::int as total from audit_logs`;
    assert.equal(audits.total, 2);
    await assert.rejects(savePartner(null, { ...values, name: "Đối tác đã sửa" }, actor, db));
    const [afterDuplicate] = await client`select count(*)::int as total from audit_logs`;
    assert.equal(afterDuplicate.total, 2);
    await assert.rejects(savePartner(null, { ...values, name: "Media không tồn tại", logoMediaId: randomUUID() }, actor, db));
    await assert.rejects(saveTestimonial(null, { avatarMediaId: randomUUID(), authorName: "Media không tồn tại", authorRole: null, company: null, quote: "Nội dung", rating: null, sortOrder: 0, isEnabled: false }, actor, db));
    await assert.rejects(savePartner(null, { ...values, name: "Actor không tồn tại" }, randomUUID(), db));
    assert.equal((await listPartnersPage({ ...partnersQuery, query: "không tồn tại" }, db)).total, 0);
    assert.equal((await listTestimonialsPage({ ...testimonialsQuery, query: "Media không tồn tại" }, db)).total, 0);
    assert.equal(await deleteDisabledPartner(ids[0], actor, db), undefined);
    assert.equal(await deleteDisabledPartner(createdId, actor, db), createdId);
    assert.equal((await listPartnersPage({ ...partnersQuery, query: "Đối tác đã sửa" }, db)).total, 0);
    const [deleted] = await client`select deleted_at from partners where id=${createdId}`;
    assert.ok(deleted.deleted_at);
    assert.equal(await deleteDisabledPartner(createdId, actor, db), undefined);
    assert.equal(await deleteDisabledPartner(randomUUID(), actor, db), undefined);
    assert.equal(await savePartner(createdId, values, actor, db), undefined);
    const [afterDelete] = await client`select count(*)::int as total from audit_logs`;
    assert.equal(afterDelete.total, 3);
    const [deleteAudit] = await client`select action, entity_id, before_data from audit_logs where action='partner.delete'`;
    assert.equal(deleteAudit.entity_id, createdId);
    assert.equal(deleteAudit.before_data.name, "Đối tác đã sửa");
    const testimonialValues = testimonialInputSchema.parse({ avatarMediaId: null, authorName: "  Tác giả CRUD  ", authorRole: null, company: " Doanh nghiệp thử ", quote: " Nội dung thử ", rating: 4, sortOrder: 10, isEnabled: true });
    const testimonialId = await saveTestimonial(null, testimonialValues, actor, db);
    assert.ok(testimonialId);
    const createdTestimonial = await listTestimonialsPage({ ...testimonialsQuery, query: "Tác giả CRUD" }, db);
    assert.equal(createdTestimonial.total, 1);
    assert.equal(createdTestimonial.items[0].testimonial.id, testimonialId);
    assert.equal(createdTestimonial.items[0].testimonial.quote, "Nội dung thử");
    assert.equal(await deleteDisabledTestimonial(testimonialId, actor, db), undefined);
    assert.equal(await saveTestimonial(testimonialId, { ...testimonialValues, quote: "Đã sửa đánh giá", rating: 5, isEnabled: false }, actor, db), testimonialId);
    const updatedTestimonial = await listTestimonialsPage({ ...testimonialsQuery, query: "Đã sửa đánh giá", visibility: "disabled" }, db);
    assert.equal(updatedTestimonial.total, 1);
    assert.equal(updatedTestimonial.items[0].testimonial.rating, 5);
    assert.equal(await deleteDisabledTestimonial(testimonialId, actor, db), testimonialId);
    assert.equal((await listTestimonialsPage({ ...testimonialsQuery, query: "Tác giả CRUD" }, db)).total, 0);
    assert.equal(await deleteDisabledTestimonial(testimonialId, actor, db), undefined);
    assert.equal(await saveTestimonial(testimonialId, testimonialValues, actor, db), undefined);
    assert.equal(await saveTestimonial(randomUUID(), testimonialValues, actor, db), undefined);
    const [finalAudits] = await client`select count(*)::int as total from audit_logs`;
    assert.equal(finalAudits.total, 6);
    // Constraint chỉ nằm trong schema fixture, ép lỗi sau bước ghi dữ liệu.
    await client`alter table audit_logs add constraint reject_fixture_audit check (action not in ('partner.create', 'partner.update', 'partner.delete', 'testimonial.create', 'testimonial.update', 'testimonial.delete')) not valid`;
    await assert.rejects(savePartner(null, { ...values, name: "Rollback đối tác" }, actor, db));
    await assert.rejects(saveTestimonial(null, { ...testimonialValues, authorName: "Rollback đánh giá" }, actor, db));
    assert.equal((await listPartnersPage({ ...partnersQuery, query: "Rollback đối tác" }, db)).total, 0);
    assert.equal((await listTestimonialsPage({ ...testimonialsQuery, query: "Rollback đánh giá" }, db)).total, 0);
    await assert.rejects(savePartner(ids[6], { ...values, name: "Sửa lỗi đối tác" }, actor, db));
    await assert.rejects(saveTestimonial(ids[6], { ...testimonialValues, quote: "Sửa lỗi đánh giá" }, actor, db));
    const [unchangedPartner] = await client`select name, deleted_at from partners where id=${ids[6]}`;
    const [unchangedTestimonial] = await client`select quote, deleted_at from testimonials where id=${ids[6]}`;
    assert.equal(unchangedPartner.name, "Đối tác 06");
    assert.equal(unchangedTestimonial.quote, "100%_ nội dung");
    await assert.rejects(deleteDisabledPartner(ids[6], actor, db));
    await assert.rejects(deleteDisabledTestimonial(ids[6], actor, db));
    const [partnerAfterFailedDelete] = await client`select deleted_at from partners where id=${ids[6]}`;
    const [testimonialAfterFailedDelete] = await client`select deleted_at from testimonials where id=${ids[6]}`;
    assert.equal(partnerAfterFailedDelete.deleted_at, null);
    assert.equal(testimonialAfterFailedDelete.deleted_at, null);
    const [afterRollback] = await client`select count(*)::int as total from audit_logs`;
    assert.equal(afterRollback.total, 6);
    await client`alter table audit_logs drop constraint reject_fixture_audit`;
    console.log("Đạt: phân trang thương hiệu 5/5/2, thứ tự ổn định, filter/count, literal wildcard và soft-delete.");
    console.log("Đạt: tạo/sửa đối tác, đọc lại đúng dữ liệu, ID thiếu không audit và tên trùng rollback.");
    console.log("Đạt: chặn xóa đang hiện, xóa mềm đang ẩn, audit đúng đối tượng và không sửa/xóa lại ID đã xóa.");
    console.log("Đạt: tạo/sửa/xóa mềm đánh giá, filter đọc lại đúng, chặn xóa đang hiện và không ghi audit lặp.");
    console.log("Đạt: lỗi ghi audit rollback tạo/sửa/xóa cả đối tác và đánh giá, dữ liệu và audit không dở dang.");
  } catch {
    console.error("Audit thương hiệu DB thất bại; không in SQL hoặc dữ liệu nhạy cảm.");
    process.exitCode = 1;
  } finally {
    if (created) {
      if (!/^cms_supporting_audit_[a-f0-9]{32}$/.test(scope)) throw new Error("Schema kiểm thử không hợp lệ.");
      await client`drop schema ${client(scope)} cascade`;
      const [remaining] = await client`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`;
      assert.equal(remaining.total, 0);
      console.log("Đã dọn schema thương hiệu kiểm thử; không thay public.");
    }
    await client.end({ timeout: 10 });
  }
}
void main().catch(() => { console.error("Không hoàn tất dọn dẹp audit thương hiệu local."); process.exitCode = 1; });
