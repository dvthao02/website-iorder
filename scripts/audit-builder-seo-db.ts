import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import postgres from "postgres";

config({ quiet: true });
const originalUrl = process.env.DATABASE_URL;
if (!originalUrl || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(originalUrl).hostname)) throw new Error("Kiểm thử chỉ chạy trên PostgreSQL local.");
const scope = `cms_builder_audit_${randomUUID().replaceAll("-", "")}`;
const client = postgres(originalUrl, { max: 1, prepare: false, onnotice: () => undefined });
const isolatedUrl = new URL(originalUrl);
isolatedUrl.searchParams.set("options", `-c search_path=${scope}`);
process.env.DATABASE_URL = isolatedUrl.toString();
process.env.PREVIEW_SECRET = randomBytes(32).toString("hex");
const actor = randomUUID();
const cookie = randomBytes(32).toString("base64url");
const common = { status: "published", scheduledAt: null, seoTitle: "Tiêu đề SEO cũ", seoDescription: "Mô tả SEO cũ vẫn được giữ nguyên.", canonicalUrl: "https://example.com/trang/kiem-thu" } as const;
const seo = { index: true, follow: false, sitemap: true, breadcrumbs: false, openGraph: { title: "Chia sẻ Facebook", description: "Mô tả Facebook" }, twitter: { title: "Chia sẻ X", card: "summary" as const }, structuredData: [{ type: "Service" as const, name: "Dịch vụ kiểm thử" }] };
const textBlock = { type: "rich_text" as const, data: { heading: "Nội dung đã lưu", body: "Thông tin được truyền đầy đủ từ CMS." }, isEnabled: true };
const blocks = [textBlock,
  { type: "features" as const, isEnabled: true, data: { eyebrow: null, title: "Các thẻ kiểm thử", description: null, items: [{ title: "Thẻ đầu", description: "Thông tin thẻ đầu", href: null }, { title: "Thẻ thứ hai", description: "Thông tin thẻ thứ hai", href: null }] } },
  { type: "grouped_list" as const, isEnabled: true, data: { eyebrow: null, title: "Nhóm kiểm thử", description: null, groupLabel: null, showCount: true, groups: [{ title: "Nhóm đầu", icon: null, action: null, items: [{ label: "Mục con đầu", icon: null, href: null }] }] } },
];
let created = false;
let step = "chuẩn bị";

async function main() {
  try {
    const publicBefore = await client`select table_name, column_name, data_type from information_schema.columns where table_schema='public' order by table_name, ordinal_position`;
    await client`create schema ${client(scope)}`;
    created = true;
    const tables = await client`select tablename from pg_tables where schemaname='public' and tablename <> 'builder_previews'`;
    for (const { tablename } of tables) await client`create table ${client(scope)}.${client(tablename)} (like public.${client(tablename)} including all)`;
    await client`select set_config('search_path', ${scope}, false)`;
    assert.equal((await client`select current_schema() as name`)[0].name, scope);
    // Chỉ thay schema tạm: dựng trạng thái trước 0017/0018 kể cả khi local đã được nâng cấp.
    for (const table of ["pages", "posts", "offerings", "sales_equipment"]) await client`alter table ${client(table)} drop column if exists seo`;
    await client`alter table sales_equipment drop column if exists blocks`;
    await client`insert into pages (title,slug,seo_title,seo_description,canonical_url) values ('Trang trước migration','truoc-migration',${common.seoTitle},${common.seoDescription},${common.canonicalUrl})`;
    step = "migration";
    for (const name of ["0017_cms_builder_seo.sql", "0018_equipment_builder_seo.sql"]) {
      const sql = (await readFile(`drizzle/${name}`, "utf8")).replaceAll('"public".', `"${scope}".`);
      for (const statement of sql.split("--> statement-breakpoint").filter(value => value.trim())) await client.unsafe(statement);
    }
    const [legacy] = await client`select seo_title,seo_description,canonical_url,seo from pages where slug='truoc-migration'`;
    assert.equal(legacy.seo_title, common.seoTitle);
    assert.equal(legacy.seo_description, common.seoDescription);
    assert.equal(legacy.canonical_url, common.canonicalUrl);
    assert.deepEqual(legacy.seo, {});
    await client`insert into users (id,username,full_name,password_hash) values (${actor},'builder-audit','Người kiểm thử','khong-dung-de-dang-nhap')`;
    const roleId = randomUUID();
    await client`insert into roles (id,code,name) values (${roleId},'admin','Quản trị')`;
    await client`insert into user_roles (user_id,role_id) values (${actor},${roleId})`;
    await client`insert into sessions (user_id,token_hash,expires_at) values (${actor},${createHash("sha256").update(cookie).digest("base64url")},${new Date(Date.now() + 3600000)})`;
    const { getDb } = await import("../packages/core/src/db/client");
    const db = getDb();
    const { sql } = await import("drizzle-orm");
    assert.equal((await db.execute(sql`select current_schema() as name`))[0].name, scope);
    const pageService = await import("../packages/core/src/server/pages/pages.service");
    const postService = await import("../packages/core/src/server/posts/posts.service");
    const offeringService = await import("../packages/core/src/server/offerings/offerings.service");
    const equipmentService = await import("../packages/core/src/server/equipment/equipment.service");
    const revisions = await import("../packages/core/src/server/revisions/revisions.service");
    const previewService = await import("../packages/core/src/server/publishing/builder-preview.service");
    const previewRepo = await import("../packages/core/src/server/publishing/builder-preview.repository");
    const { builderPreviewRequestSchema } = await import("../packages/core/src/server/publishing/builder-preview.contract");
    const { PageVersionConflictError } = await import("../packages/core/src/server/pages/page-version");
    const { ContentVersionConflictError } = await import("../packages/core/src/server/shared/content-version");
    step = "trang và phiên bản";
    const pageValues = { ...common, title: "Trang kiểm thử", slug: "kiem-thu-builder", template: "default", blocks, seo };
    const { fixedWebsitePages, pageBlockInputSchema } = await import("../packages/core/src/server/pages/pages.contract");
    const homeHero = pageBlockInputSchema.parse({ type: "hero", isEnabled: true, data: { eyebrow: null, title: "Phần đầu kiểm thử", description: "Nội dung từ CMS", primaryAction: null, secondaryAction: null }, appearance: { tone: "custom", backgroundColor: "#fff7ed", width: 60, anchor: "hero-tu-cms" } });
    const homeFeatures = pageBlockInputSchema.parse({ ...blocks[1], appearance: { tone: "custom", backgroundColor: "#e0f2fe", spacing: "lg", width: 60, anchor: "khoang-cach-tu-cms" } });
    for (const fixed of fixedWebsitePages) await pageService.saveAdminPage(null, { ...pageValues, title: fixed.label, slug: fixed.slug, template: fixed.template, blocks: fixed.kind === "listing" ? [] : fixed.slug === "home" ? [homeHero, homeFeatures, ...blocks] : blocks }, actor, { allowFixedPageCreation: true });
    const page = await pageService.saveAdminPage(null, pageValues, actor);
    assert.ok(page);
    assert.deepEqual(page.seo, seo);
    const { seo: omittedSeo, ...legacyInput } = pageValues;
    assert.ok(omittedSeo);
    const saved = await pageService.saveAdminPage(page.id, { ...legacyInput, title: "Sửa bằng API cũ" }, actor, { expectedVersion: 1 });
    assert.deepEqual(saved?.seo, seo);
    assert.deepEqual((await pageService.getPublishedPage(page.slug))?.seo, seo);
    await assert.rejects(pageService.saveAdminPage(page.id, pageValues, actor, { expectedVersion: 1 }), PageVersionConflictError);
    const history = await revisions.getRevisionHistory("pages", page.id);
    await revisions.restoreRevision("pages", page.id, history.find(row => row.version === 1)!.id, actor, 2);
    assert.deepEqual((await pageService.getAdminPageById(page.id))?.seo, seo);
    assert.equal((await pageService.getAdminPageById(page.id))?.title, pageValues.title);
    const renamed = await pageService.saveAdminPage(page.id, { ...pageValues, slug: "kiem-thu-doi-url" }, actor, { expectedVersion: 3 });
    assert.equal(renamed?.draftVersion, 4);
    const redirects = await client`select status_code from redirects where source_path='/trang/kiem-thu-builder' and destination_path='/trang/kiem-thu-doi-url'`;
    assert.equal(redirects[0]?.status_code, 301);
    await assert.rejects(pageService.saveAdminPage(page.id, { ...pageValues, slug: "home" }, actor, { expectedVersion: 4 }));
    step = "bài viết và hướng dẫn";
    const postValues = { ...common, title: "Bài kiểm thử", slug: "bai-kiem-thu", type: "news", excerpt: "Tóm tắt bài viết", content: { version: 2, doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Nội dung Rich Text dùng chung." }] }] } }, promotionStartAt: null, promotionEndAt: null, ctaLabel: null, ctaUrl: null, badgeText: null, seo };
    const post = await postService.createAdminPost(postValues, actor);
    const guide = await postService.createAdminPost({ ...postValues, type: "guide", slug: "huong-dan-kiem-thu" }, actor);
    const { seo: postSeo, ...postLegacy } = postValues;
    assert.ok(postSeo);
    assert.deepEqual((await postService.updateAdminPost(post.id, postLegacy, actor, undefined, 1))?.seo, seo);
    assert.deepEqual((await postService.getPublishedPostBySlug(guide.slug))?.content, guide.content);
    await assert.rejects(postService.updateAdminPost(post.id, postValues, actor, undefined, 1), ContentVersionConflictError);
    step = "catalog";
    const offeringValues = { ...common, title: "Phần mềm kiểm thử", slug: "phan-mem-kiem-thu", type: "software", summary: "Tóm tắt catalog", content: { description: "Mô tả cũ được giữ", tags: [], bestFor: null, keyValue: null, metrics: [], features: [], benefits: [], faq: [], items: [], category: null, blocks }, icon: null, sortOrder: 0, isFeatured: false, seo };
    const offering = await offeringService.createAdminOffering(offeringValues, actor);
    for (const type of ["solution", "service"]) await offeringService.createAdminOffering({ ...offeringValues, type, slug: `${type}-kiem-thu` }, actor);
    const { seo: offeringSeo, ...offeringLegacy } = offeringValues;
    assert.ok(offeringSeo);
    assert.deepEqual((await offeringService.updateAdminOffering(offering.id, offeringLegacy, actor, undefined, 1))?.seo, seo);
    assert.deepEqual((await offeringService.getPublishedOfferingBySlug("software", offering.slug))?.content.blocks, blocks);
    step = "thiết bị";
    const groupId = await equipmentService.writeEquipment("groups", null, { name: "Nhóm kiểm thử", slug: "nhom-kiem-thu", description: null, coverMediaId: null, sortOrder: 0, isEnabled: true }, actor);
    assert.ok(groupId);
    const equipmentValues = { ...common, groupId, name: "Thiết bị kiểm thử", slug: "thiet-bi-kiem-thu", modelCode: null, coverMediaId: null, priceVnd: 1000000, warrantyMonths: 12, summary: "Tóm tắt thiết bị", specificationGroups: [], sortOrder: 0, isFeatured: false, blocks, seo };
    const equipmentId = await equipmentService.writeEquipment("items", null, equipmentValues, actor);
    assert.ok(equipmentId);
    const { seo: equipmentSeo, blocks: equipmentBlocks, ...equipmentLegacy } = equipmentValues;
    assert.ok(equipmentSeo && equipmentBlocks);
    await equipmentService.writeEquipment("items", equipmentId, equipmentLegacy, actor, undefined, 1);
    const equipment = await equipmentService.getEquipmentById(equipmentId);
    assert.deepEqual(equipment?.seo, seo);
    assert.deepEqual(equipment?.blocks, blocks);
    step = "ảnh SEO và tham chiếu media";
    const mediaId = randomUUID();
    await client`insert into media_assets (id,storage_key,original_name,mime_type,file_size) values (${mediaId},'audit/builder.png','builder.png','image/png',1)`;
    const mediaPage = await pageService.saveAdminPage(null, { ...pageValues, slug: "anh-seo-kiem-thu", status: "draft", seo: { openGraph: { imageMediaId: mediaId } } }, actor);
    assert.ok(mediaPage);
    const { collectMediaUsage } = await import("../packages/core/src/server/media/media.repository");
    assert.ok((await collectMediaUsage(mediaId)).some(usage => usage.entityType === "page" && usage.entityId === mediaPage.id));
    await assert.rejects(pageService.saveAdminPage(null, { ...pageValues, slug: "anh-seo-khong-ton-tai", seo: { twitter: { imageMediaId: randomUUID() } } }, actor));
    await equipmentService.writeEquipment("items", equipmentId, { ...equipmentValues, seo: { ...seo, twitter: { ...seo.twitter, imageMediaId: mediaId } } }, actor, undefined, 2);
    assert.ok((await collectMediaUsage(mediaId)).some(usage => usage.entityType === "equipment" && usage.entityId === equipmentId));
    step = "nháp và xuất bản";
    const workflowPage = await pageService.saveAdminPage(null, { ...pageValues, slug: "kiem-thu-vong-doi", status: "draft" }, actor);
    assert.ok(workflowPage);
    assert.equal(await pageService.getPublishedPage(workflowPage.slug), undefined);
    assert.deepEqual((await pageService.changeAdminPageState(workflowPage.id, "publish", actor, 1))?.seo, seo);
    assert.deepEqual((await pageService.getPublishedPage(workflowPage.slug))?.seo, seo);
    await pageService.changeAdminPageState(workflowPage.id, "unpublish", actor, 2);
    assert.equal(await pageService.getPublishedPage(workflowPage.slug), undefined);
    assert.deepEqual((await pageService.getAdminPageById(workflowPage.id))?.seo, seo);
    const workflowPost = await postService.createAdminPost({ ...postValues, slug: "bai-vong-doi", status: "draft" }, actor);
    assert.deepEqual((await postService.changeAdminPostState(workflowPost.id, "publish", actor, 1))?.seo, seo);
    assert.deepEqual((await postService.changeAdminPostState(workflowPost.id, "unpublish", actor, 2))?.seo, seo);
    const workflowOffering = await offeringService.createAdminOffering({ ...offeringValues, slug: "catalog-vong-doi", status: "draft" }, actor);
    assert.deepEqual((await offeringService.changeAdminOfferingState(workflowOffering.id, "publish", actor, 1))?.seo, seo);
    assert.deepEqual((await offeringService.changeAdminOfferingState(workflowOffering.id, "unpublish", actor, 2))?.seo, seo);
    const workflowEquipmentId = await equipmentService.writeEquipment("items", null, { ...equipmentValues, slug: "thiet-bi-vong-doi", status: "draft" }, actor);
    assert.ok(workflowEquipmentId);
    await equipmentService.changeAdminEquipmentState(workflowEquipmentId, "publish", actor, 1);
    assert.deepEqual((await equipmentService.getEquipment(true)).find(item => item.id === workflowEquipmentId)?.seo, seo);
    await equipmentService.changeAdminEquipmentState(workflowEquipmentId, "unpublish", actor, 2);
    assert.ok(!(await equipmentService.getEquipment(true)).some(item => item.id === workflowEquipmentId));
    assert.deepEqual((await equipmentService.getEquipmentById(workflowEquipmentId))?.blocks, blocks);
    step = "preview chưa lưu";
    const counts = async () => (await client`select (select count(*) from pages)::int as pages,(select count(*) from page_revisions)::int as revisions,(select count(*) from audit_logs)::int as audits`)[0];
    const beforePreview = await counts();
    const previewValues = { ...pageValues, title: "Chưa lưu vào nội dung", slug: "kiem-thu-doi-url", blocks: [{ ...textBlock, data: { ...textBlock.data, heading: "PREVIEW CHƯA LƯU" } }] };
    const request = builderPreviewRequestSchema.parse({ previewId: randomUUID(), documentId: page.id, sequence: 2, parentOrigin: "http://localhost:3201", document: { kind: "page", values: previewValues } });
    const preview = await previewService.saveBuilderPreview(actor, request);
    assert.ok(preview);
    const live = await previewService.readBuilderPreview(preview.token);
    assert.ok(live);
    assert.equal(live.path, "/trang/kiem-thu-doi-url");
    assert.equal((await previewService.builderPreviewPublicContent(live)).page?.title, previewValues.title);
    assert.equal(await previewRepo.writeBuilderPreview(actor, { ...request, sequence: 1 }), undefined);
    const otherActor = randomUUID();
    await client`insert into users (id,username,full_name,password_hash) values (${otherActor},'builder-autre','Người khác','khong-dung-de-dang-nhap')`;
    assert.equal(await previewRepo.writeBuilderPreview(otherActor, { ...request, sequence: 3 }), undefined);
    assert.deepEqual(await counts(), beforePreview);
    assert.equal(await previewService.readBuilderPreview(`${preview.token}x`), undefined);
    const expiring = { ...request, previewId: randomUUID(), sequence: 1 };
    await previewRepo.writeBuilderPreview(actor, expiring, db, new Date(Date.now() - 3600000));
    assert.equal(await previewRepo.findBuilderPreview(expiring.previewId), undefined);
    for (const document of [{ kind: "offering", values: offeringValues }, { kind: "equipment", values: equipmentValues }] as const) {
      const next = await previewService.saveBuilderPreview(actor, { ...request, previewId: randomUUID(), sequence: 1, document });
      const descriptor = await previewService.readBuilderPreview(next?.token);
      assert.ok(descriptor);
      const publicContent = await previewService.builderPreviewPublicContent(descriptor);
      assert.ok(document.kind === "offering" ? publicContent.offering?.content.blocks?.length : publicContent.equipment?.some(item => item.slug === equipmentValues.slug && item.blocks?.length));
    }
    // Các test HTTP dùng backend/website build thật nếu --http, cùng schema và secret trong bộ nhớ.
    if (process.argv.includes("--http")) {
      step = "HTTP và trình duyệt";
      const { auditBuilderHttp } = await import("./lib/audit-builder-http");
      await auditBuilderHttp({ databaseUrl: isolatedUrl.toString(), previewSecret: process.env.PREVIEW_SECRET!, cookie, page: renamed!, pageValues: { ...pageValues, slug: renamed!.slug }, actor, client });
    }
    assert.deepEqual(await client`select table_name,column_name,data_type from information_schema.columns where table_schema='public' order by table_name,ordinal_position`, publicBefore);
    console.log("Đạt: migration 0017/0018 giữ metadata cũ; pages/posts/guides/offerings/equipment lưu, đọc và giữ SEO khi API cũ bỏ trường mở rộng.");
    console.log("Đạt: blocks thiết bị; lịch sử/khôi phục SEO; version conflict; đổi slug tạo 301; bảo vệ slug hệ thống.");
    console.log("Đạt: lưu nháp → xuất bản → về nháp giữ SEO và blocks của trang, bài viết, catalog và thiết bị; ảnh SEO được theo dõi trong Media Library.");
    console.log("Đạt: preview chưa lưu dùng DTO website thật, kiểm chủ sở hữu/thứ tự/hết hạn/chữ ký và không sửa nội dung, revision hoặc audit.");
  } catch (error) {
    console.error(`Kiểm thử thất bại tại: ${step}.`, error instanceof assert.AssertionError ? error.message : error instanceof Error ? error.name : "Lỗi không xác định");
    process.exitCode = 1;
  } finally {
    if (created) {
      if (!/^cms_builder_audit_[a-f0-9]{32}$/.test(scope)) throw new Error("Schema tạm không hợp lệ.");
      await client`drop schema ${client(scope)} cascade`;
      assert.equal((await client`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`)[0].total, 0);
      console.log("Đã dọn schema tạm; không ghi vào dữ liệu public.");
    }
    await client.end({ timeout: 10 });
  }
}
void main().catch(() => { console.error("Không hoàn tất dọn kiểm thử local."); process.exitCode = 1; });
