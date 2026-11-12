import assert from "node:assert/strict";
import test from "node:test";
import { pageValidationMessage } from "./page-validation";
import { adminPagesPageSchema, fixedWebsitePages, heroToneOf, isListingPageSlug, listingHeaderFromBlocks, listingLayoutFromBlocks, pageBlockInputSchema, pageListQuerySchema, pagePermissionCodes, pageSaveRequestSchema } from "./pages.contract";
import { publicationDate } from "../shared/publication-date";
import { offeringContentSchema } from "../offerings/offering-content.contract";
import { assertPageVersion, PageVersionConflictError } from "./page-version";

test("Khối logo giữ mô tả qua contract và vẫn đọc được dữ liệu cũ", () => {
  const block = { type: "partners", isEnabled: true, data: { eyebrow: null, title: "Đối tác", kind: "all", limit: 28 } };
  assert.ok(pageBlockInputSchema.safeParse(block).success);
  const saved = pageBlockInputSchema.parse({ ...block, data: { ...block.data, description: "  Đồng hành cùng cửa hàng  " } });
  assert.equal(saved.type === "partners" && saved.data.description, "Đồng hành cùng cửa hàng");
  assert.equal(pageBlockInputSchema.safeParse({ ...block, data: { ...block.data, description: "a".repeat(2001) } }).success, false);
});

test("Phiên bản Trang cũ/thiếu/sai bị từ chối, đúng phiên bản được phép", () => {
  assert.doesNotThrow(() => assertPageVersion(3, 3));
  for (const expected of [undefined, 2, 4, -1, 3.5, NaN]) assert.throws(() => assertPageVersion(3, expected), PageVersionConflictError);
});

test("Xuất bản ngay bỏ lịch tương lai, sửa trang đã công khai giữ ngày gốc", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const future = new Date("2026-11-10T00:00:00Z");
  const past = new Date("2026-09-10T00:00:00Z");
  assert.equal(publicationDate({ status: "published", scheduledAt: future }, { status: "scheduled", publishedAt: future }, now), now);
  assert.equal(publicationDate({ status: "published", scheduledAt: null }, { status: "published", publishedAt: future }, now), now);
  assert.equal(publicationDate({ status: "published", scheduledAt: null }, { status: "published", publishedAt: past }, now), past);
  assert.equal(publicationDate({ status: "scheduled", scheduledAt: future }, undefined, now), future);
  for (const status of ["draft", "review", "archived"]) assert.equal(publicationDate({ status, scheduledAt: future }, undefined, now), null);
});

const row = { id: "11111111-1111-4111-8111-111111111111", title: "Trang thử", slug: "trang-thu", template: "default", status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null, scheduledAt: null, blocks: [], draftVersion: 1, publishedAt: null, updatedAt: new Date() };
const response = { items: [row], page: 1, pageSize: 7, total: 1, totalPages: 1 };
test("Cập nhật Trang bắt buộc phiên bản; tạo mới không yêu cầu", () => {
  assert.equal(pageSaveRequestSchema.safeParse({ id: row.id, values: {} }).success, false);
  assert.ok(pageSaveRequestSchema.safeParse({ id: row.id, values: {}, expectedVersion: 1 }).success);
  assert.ok(pageSaveRequestSchema.safeParse({ id: null, values: {} }).success);
});
test("Danh sách Trang kiểm ID, số hàng, tổng trang và ngày", () => {
  assert.ok(adminPagesPageSchema.safeParse(response).success);
  for (const bad of [{ ...response, total: 2 }, { ...response, totalPages: 2 }, { ...response, items: [row, row], total: 2 }, { ...response, items: [{ ...row, id: "sai" }] }, { ...response, items: [{ ...row, updatedAt: "sai" }] }]) assert.equal(adminPagesPageSchema.safeParse(bad).success, false);
  assert.ok(adminPagesPageSchema.safeParse({ ...response, page: 999, items: [] }).success);
});
test("Query Trang chuẩn hóa ở biên và giữ số mục hợp lệ ngoài preset", () => {
  const source = { query: "  Trang thử  ", pageSize: "7", status: "draft" };
  assert.equal(pageListQuerySchema.parse(source).pageSize, 7);
  assert.equal(pageListQuerySchema.parse(source).query, "Trang thử");
  assert.equal(source.query, "  Trang thử  ");
  for (const bad of [{ page: 0 }, { pageSize: 101 }, { status: "sai" }, { kind: "khac" }, { unknown: true }]) assert.equal(pageListQuerySchema.safeParse(bad).success, false);
  for (const kind of ["custom", "system", "static", "standard", "listing"]) assert.equal(pageListQuerySchema.parse({ kind }).kind, kind);
});

test("Trang danh sách nhận quyền của module sở hữu, trang thường chỉ nhận quyền Trang website", () => {
  assert.deepEqual(pagePermissionCodes("listing-news", "update"), ["pages.update", "posts.update"]);
  assert.deepEqual(pagePermissionCodes("listing-software", "publish"), ["pages.publish", "offerings.publish"]);
  assert.deepEqual(pagePermissionCodes("about", "update"), ["pages.update"]);
  assert.deepEqual(pagePermissionCodes("trang-tu-tao", "view"), ["pages.view"]);
  assert.deepEqual(pagePermissionCodes(null, "publish"), ["pages.publish"]);
});

test("Registry trang hệ thống: slug và đường dẫn không trùng, trang danh sách luôn có module sở hữu", () => {
  assert.equal(new Set(fixedWebsitePages.map(page => page.slug)).size, fixedWebsitePages.length);
  assert.equal(new Set(fixedWebsitePages.map(page => page.publicPath)).size, fixedWebsitePages.length);
  for (const page of fixedWebsitePages) assert.equal(page.kind === "listing", page.ownerModule !== null, page.slug);
  assert.equal(isListingPageSlug("listing-equipment"), true);
  assert.equal(isListingPageSlug("about"), false);
});

test("Phần đầu trang danh sách lấy từ khối Mở đầu đầu tiên đang bật", () => {
  const hero = (title: string, isEnabled: boolean) => ({ type: "hero" as const, isEnabled, data: { eyebrow: "Blog", title, description: null, primaryAction: null, secondaryAction: null, layout: "split" as const, highlights: [], footnote: null, slides: [], extraMediaIds: [], tone: null, panels: [] } });
  assert.deepEqual(listingHeaderFromBlocks([hero("Ẩn", false), hero("Tin tức", true)]), { eyebrow: "Blog", title: "Tin tức", description: null });
  assert.equal(listingHeaderFromBlocks([]), undefined);
});

test("Trang danh sách: bỏ khối Mở đầu khỏi thân trang, giữ thứ tự, tự thêm danh sách mặc định khi thiếu", () => {
  const hero = { type: "hero" as const, isEnabled: true, data: { eyebrow: null, title: "Tin tức", description: null, primaryAction: null, secondaryAction: null, layout: "split" as const, highlights: [], footnote: null, slides: [], extraMediaIds: [], tone: null, panels: [] } };
  const faq = { type: "faq" as const, isEnabled: true, data: { eyebrow: null, title: "Hỏi đáp", items: [{ question: "Q", answer: "A" }] } };
  const posts = { type: "collection_list" as const, isEnabled: true, data: { source: "posts" as const, eyebrow: null, title: null, description: null, limit: null, anchor: null } };
  assert.deepEqual(listingLayoutFromBlocks("listing-news", [hero, posts, faq])?.blocks, [posts, faq]);
  assert.deepEqual(listingLayoutFromBlocks("listing-news", [hero, faq])?.blocks.map(block => block.type), ["faq", "collection_list"]);
  assert.deepEqual(listingLayoutFromBlocks("listing-support", [hero])?.blocks.map(block => block.type === "collection_list" ? block.data.source : block.type), ["downloads"]);
  assert.deepEqual(listingLayoutFromBlocks("listing-guides", [hero])?.blocks.map(block => block.type === "collection_list" ? block.data.source : block.type), ["guides"]);
  assert.equal(listingLayoutFromBlocks("listing-news", [faq]), undefined);
});

test("Khối Danh sách nội dung kiểm tra nguồn, số lượng và mã neo", () => {
  const valid = { type: "collection_list", isEnabled: true, data: { source: "equipment", eyebrow: null, title: "Thiết bị", description: null, limit: 6, anchor: "thiet-bi" } };
  assert.equal(pageBlockInputSchema.safeParse(valid).success, true);
  assert.equal(pageBlockInputSchema.safeParse({ ...valid, data: { ...valid.data, source: "industry" } }).success, false);
  assert.equal(pageBlockInputSchema.safeParse({ ...valid, data: { ...valid.data, limit: 0 } }).success, false);
  assert.equal(pageBlockInputSchema.safeParse({ ...valid, data: { ...valid.data, anchor: "Hướng dẫn" } }).success, false);
});

test("Phần đầu trang cũ nhận nhiều ảnh và màu nền mặc định theo kiểu", () => {
  const parsed = pageBlockInputSchema.parse({ type: "hero", isEnabled: true, data: { eyebrow: null, title: "Trang chủ", description: null, primaryAction: null, secondaryAction: null, layout: "background" } });
  assert.ok(parsed.type === "hero");
  assert.deepEqual(parsed.data.extraMediaIds, []);
  assert.equal(parsed.data.tone, null);
  assert.equal(heroToneOf(parsed.data), "tinted");
  assert.equal(heroToneOf({ layout: "background", tone: "dark" }), "dark");
  assert.equal(heroToneOf({ layout: "split", tone: null }), "tinted");
  assert.equal(heroToneOf({ layout: "split", tone: "dark" }), "tinted");
  assert.equal(heroToneOf({ layout: "background", tone: "light" }), "light");
  const tooMany = Array.from({ length: 8 }, (_, index) => `00000000-0000-4000-8000-00000000000${index}`);
  assert.equal(pageBlockInputSchema.safeParse({ type: "hero", isEnabled: true, data: { ...parsed.data, extraMediaIds: tooMany } }).success, false);
});

test("Khối danh sách theo nhóm: biểu tượng phải thuộc bộ có sẵn, mặc định hiện số mục", () => {
  const group = { title: "Bán buôn, bán lẻ", icon: "store", items: [{ label: "Thời trang", icon: "shirt", href: null }], action: { label: "Tư vấn triển khai", href: "/lien-he" } };
  const parsed = pageBlockInputSchema.parse({ type: "grouped_list", isEnabled: true, data: { eyebrow: "Theo ngành hàng", title: "Phù hợp nhiều mô hình kinh doanh", description: null, groupLabel: "Nhóm ngành", groups: [group] } });
  assert.equal(parsed.type === "grouped_list" && parsed.data.showCount, true);
  assert.equal(pageBlockInputSchema.safeParse({ type: "grouped_list", isEnabled: true, data: { eyebrow: null, title: "A", description: null, groupLabel: null, groups: [{ ...group, icon: "khong-co" }] } }).success, false);
  assert.equal(pageBlockInputSchema.safeParse({ type: "grouped_list", isEnabled: true, data: { eyebrow: null, title: "A", description: null, groupLabel: null, groups: [] } }).success, false);
});

test("Lưới thẻ: ảnh thẻ và kiểu thẻ là tùy chọn, dữ liệu cũ vẫn hợp lệ, giá trị sai bị từ chối", () => {
  const photo = "22222222-2222-4222-8222-222222222222";
  const block = (data: Record<string, unknown>, type = "features") => ({ type, isEnabled: true, data: { eyebrow: null, title: "Giải pháp", description: null, items: [{ title: "Thẻ", description: "Mô tả", href: null }], ...data } });
  assert.ok(pageBlockInputSchema.safeParse(block({})).success, "thẻ cũ không có mediaId/cardStyle");
  assert.ok(pageBlockInputSchema.safeParse(block({ cardStyle: "visual", items: [{ title: "Thẻ", description: "Mô tả", href: null, icon: "store", mediaId: photo }] })).success);
  assert.ok(pageBlockInputSchema.safeParse(block({ cardStyle: "compact", items: [{ title: "Thẻ", description: "Mô tả", href: null, mediaId: null }] })).success);
  assert.equal(pageBlockInputSchema.safeParse(block({ items: [{ title: "Thẻ", description: "Mô tả", href: null, mediaId: "không-phải-uuid" }] })).success, false);
  assert.ok(pageBlockInputSchema.safeParse(block({ cardStyle: "bento" })).success, "kiểu thẻ lớn nổi bật (bento)");
  assert.equal(pageBlockInputSchema.safeParse(block({ cardStyle: "to" })).success, false);
});

test("Khối video YouTube: bắt buộc link YouTube hợp lệ, các chữ khác tùy chọn", () => {
  const video = (url: string) => ({ type: "video", isEnabled: true, data: { eyebrow: null, title: null, description: null, url, caption: null } });
  assert.ok(pageBlockInputSchema.safeParse(video("https://youtu.be/dQw4w9WgXcQ")).success);
  assert.equal(pageBlockInputSchema.safeParse(video("")).success, false);
  assert.equal(pageBlockInputSchema.safeParse(video("https://vimeo.com/1")).success, false);
});

test("Giao diện khối: dữ liệu cũ nhận mặc định; màu, ảnh nền, độ rộng được kiểm tra", () => {
  const faq = (appearance: unknown) => pageBlockInputSchema.safeParse({ type: "faq", isEnabled: true, data: { eyebrow: null, title: "Hỏi đáp", items: [{ question: "Q", answer: "A" }] }, appearance });
  const old = faq({ anchor: null, tone: "white", spacing: "auto" });
  assert.ok(old.success);
  assert.deepEqual(old.data.appearance, { anchor: null, tone: "white", spacing: "auto", width: null, backgroundColor: null, backgroundMediaId: null, backgroundOverlay: 80 });
  const custom = faq({ tone: "custom", backgroundColor: "#0A2A57", backgroundMediaId: "22222222-2222-4222-8222-222222222222", backgroundOverlay: 60, width: 80 });
  assert.ok(custom.success);
  assert.equal(custom.data.appearance?.backgroundColor, "#0a2a57");
  assert.equal(faq({ backgroundColor: "blue" }).success, false);
  assert.equal(faq({ width: 30 }).success, false);
  assert.equal(faq({ backgroundOverlay: 100 }).success, false);
});

test("Màu nền thẻ con (thẻ lưới, gói giá, nhóm) là tùy chọn và phải là mã màu", () => {
  const features = (background: unknown) => pageBlockInputSchema.safeParse({ type: "features", isEnabled: true, data: { eyebrow: null, title: "Lưới", description: null, items: [{ title: "Thẻ", description: "Mô tả", href: null, background }] } });
  assert.ok(features(undefined).success);
  assert.ok(features(null).success);
  const dark = features("#0A2A57");
  assert.ok(dark.success && dark.data.type === "features" && dark.data.data.items[0].background === "#0a2a57");
  assert.equal(features("navy").success, false);
  const plan = { name: "Cơ bản", price: "Liên hệ", period: null, description: null, features: [], action: null, highlighted: false, badge: null };
  assert.ok(pageBlockInputSchema.safeParse({ type: "pricing", isEnabled: true, data: { eyebrow: null, title: "Giá", description: null, note: null, plans: [{ ...plan, background: "#fff7ed" }] } }).success);
  assert.equal(pageBlockInputSchema.safeParse({ type: "pricing", isEnabled: true, data: { eyebrow: null, title: "Giá", description: null, note: null, plans: [{ ...plan, background: "#fff" }] } }).success, false);
});

test("Nội dung sản phẩm: dữ liệu cũ không có giao diện các phần vẫn hợp lệ; giao diện từng phần dùng vỏ chung", () => {
  const content = { description: "Mô tả", tags: [], bestFor: null, keyValue: null, metrics: [], features: [], benefits: [], faq: [], items: [], category: null };
  const old = offeringContentSchema.safeParse(content);
  assert.ok(old.success);
  assert.deepEqual(old.data.appearance, {});
  const styled = offeringContentSchema.safeParse({ ...content, appearance: { benefits: { tone: "custom", backgroundColor: "#0A2A57", width: 80 } } });
  assert.ok(styled.success);
  assert.equal(styled.data.appearance.benefits?.backgroundColor, "#0a2a57");
  assert.equal(offeringContentSchema.safeParse({ ...content, appearance: { footer: {} } }).success, false);
  // Bố cục phần đầu trang (tùy chọn): điền mặc định, chặn giá trị lạ.
  const hero = offeringContentSchema.safeParse({ ...content, appearance: { hero: { layout: "centered" } } });
  assert.ok(hero.success);
  assert.deepEqual(hero.data.appearance.hero, { layout: "centered", height: "screen", background: "default" });
  assert.equal(offeringContentSchema.safeParse({ ...content, appearance: { hero: { layout: "left" } } }).success, false);
  const composed = offeringContentSchema.safeParse({ ...content, description: "", blocks: [{ type: "rich_text", isEnabled: true, data: { heading: "Tổng quan", body: "Mô tả chi tiết" } }] });
  assert.ok(composed.success);
  assert.equal(offeringContentSchema.safeParse({ ...content, description: "", blocks: [] }).success, false);
});

test("Mục trượt giữ ảnh và điểm riêng, phân biệt dùng chung với không có điểm", () => {
  const data = { eyebrow: null, title: "Trang chủ", description: null, primaryAction: null, secondaryAction: null, layout: "split", highlights: [{ title: "Điểm chung", note: null }] };
  const panel = { eyebrow: null, title: "Mục hai", description: null, primaryAction: null, secondaryAction: null, mediaId: "22222222-2222-4222-8222-222222222222" };
  const parse = (highlights?: unknown) => pageBlockInputSchema.parse({ type: "hero", isEnabled: true, data: { ...data, panels: [{ ...panel, ...(highlights === undefined ? {} : { highlights }) }] } });
  const legacy = parse();
  assert.ok(legacy.type === "hero");
  assert.equal(legacy.data.panels[0].highlights, undefined);
  assert.equal(legacy.data.panels[0].mediaId, panel.mediaId);
  const empty = parse([]);
  assert.ok(empty.type === "hero");
  assert.deepEqual(empty.data.panels[0].highlights, []);
  const own = parse([{ title: "Điểm riêng", note: "Dòng phụ", isEnabled: true }]);
  assert.ok(own.type === "hero");
  assert.deepEqual(own.data.panels[0].highlights, [{ title: "Điểm riêng", note: "Dòng phụ", isEnabled: true }]);
  assert.deepEqual(own.data.highlights, data.highlights);
  assert.throws(() => parse(Array.from({ length: 5 }, () => ({ title: "Quá giới hạn", note: null }))));
});

test("Lỗi nội dung nêu đúng đường dẫn cha con và không lộ nội dung nhập", () => {
  const block = pageBlockInputSchema.safeParse({ type: "hero", isEnabled: true, data: { eyebrow: null, title: "Trang chủ", description: null, primaryAction: null, secondaryAction: null, layout: "split", panels: [{ eyebrow: null, title: "x".repeat(221), description: null, primaryAction: null, secondaryAction: null, mediaId: null }] } });
  assert.ok(!block.success);
  const issues = block.error.issues.map(issue => ({ ...issue, path: ["blocks", 2, ...issue.path.filter(part => part !== "data")] }));
  assert.match(pageValidationMessage(issues), /Thành phần 3 → Mục trượt bổ sung 1 → Tiêu đề: Vượt giới hạn 220 ký tự/);
  assert.ok(!pageValidationMessage(issues).includes("xxxxx"));
});

test("Lỗi trường trống nêu tên dễ hiểu", () => {
  const result = pageBlockInputSchema.safeParse({ type: "faq", isEnabled: true, data: { eyebrow: null, title: "", items: [{ question: "Hỏi", answer: "Đáp" }] } });
  assert.ok(!result.success);
  assert.match(pageValidationMessage(result.error.issues), /Tiêu đề: Không được để trống/);
});

test("Trang danh sách giữ nguyên khối cha và mọi bố cục con để publish dùng đúng một cấu hình", () => {
  for (const layout of ["split", "split_reverse", "background", "centered", "slider"]) {
    const hero = pageBlockInputSchema.parse({ type: "hero", isEnabled: true, appearance: { anchor: "dich-vu", tone: "custom", backgroundColor: "#eef7ff", width: 75 }, data: { eyebrow: null, title: "Dịch vụ", description: "Mô tả", primaryAction: { label: "Tư vấn", href: "/lien-he" }, secondaryAction: null, layout, highlights: [{ title: "Điểm chung", note: null }], panels: [{ eyebrow: null, title: "Mục 2", description: null, primaryAction: null, secondaryAction: null, mediaId: null, highlights: [{ title: "Điểm riêng", note: null }] }] } });
    const listing = listingLayoutFromBlocks("listing-service", [hero])!;
    assert.deepEqual(listing.hero, hero);
    assert.equal(listing.blocks.filter(block => block.type === "hero").length, 0);
    assert.equal(listing.blocks[0].type, "collection_list");
    assert.equal(listing.hero!.data.layout, layout);
  }
  const fallback = listingLayoutFromBlocks("listing-service", [], { eyebrow: null, title: "Dịch vụ", description: null })!;
  assert.equal(fallback.hero, undefined);
  assert.deepEqual(fallback.blocks.map(block => block.type), ["collection_list"]);
});

test("Khối nhiều cột: 2–4 cột, mục lồng một cấp, điền mặc định và chặn cấu trúc sai", () => {
  const base = { type: "columns", isEnabled: true, data: { eyebrow: null, title: null, columns: [{ items: [{ kind: "heading", text: "Tiêu đề" }, { kind: "text", text: "Nội dung" }] }, { items: [{ kind: "image", mediaId: null, alt: null }] }] } };
  const saved = pageBlockInputSchema.parse(base);
  assert.ok(saved.type === "columns");
  assert.equal(saved.data.layout, "equal");
  assert.equal(saved.data.gap, "md");
  assert.equal(saved.data.verticalAlign, "center");
  assert.equal(saved.data.stack, "normal");
  assert.deepEqual(saved.data.columns[0].items[0], { kind: "heading", text: "Tiêu đề", level: "h3", align: "left" });
  assert.deepEqual(saved.data.columns[1].items[0], { kind: "image", mediaId: null, alt: null, fit: "contain" });
  assert.equal(pageBlockInputSchema.safeParse({ ...base, data: { ...base.data, columns: [{ items: [] }] } }).success, false, "ít hơn 2 cột");
  assert.equal(pageBlockInputSchema.safeParse({ ...base, data: { ...base.data, columns: [1, 2, 3, 4, 5].map(() => ({ items: [] })) } }).success, false, "quá 4 cột");
  assert.equal(pageBlockInputSchema.safeParse({ ...base, data: { ...base.data, columns: [{ items: [{ kind: "columns", columns: [] }] }, { items: [] }] } }).success, false, "không lồng cột trong cột");
  assert.equal(pageBlockInputSchema.safeParse({ ...base, data: { ...base.data, columns: [{ items: [{ kind: "button", label: "", href: "/lien-he" }] }, { items: [] }] } }).success, false, "nút thiếu chữ");
});

test("Căn chữ riêng của mục con (thẻ, số liệu): tùy chọn, dữ liệu cũ vẫn hợp lệ, chặn giá trị lạ", () => {
  const card = { title: "Thẻ", description: "", href: null };
  const features = (item: unknown) => ({ type: "features", isEnabled: true, data: { eyebrow: null, title: "Lợi ích", description: null, items: [item] } });
  assert.ok(pageBlockInputSchema.safeParse(features(card)).success);
  const saved = pageBlockInputSchema.parse(features({ ...card, align: "center" }));
  assert.ok(saved.type === "features" && saved.data.items[0].align === "center");
  assert.equal(pageBlockInputSchema.safeParse(features({ ...card, align: "justify" })).success, false);
  const stats = (item: unknown) => ({ type: "stats", isEnabled: true, data: { eyebrow: null, title: null, items: [item] } });
  assert.ok(pageBlockInputSchema.safeParse(stats({ value: "1", label: "Nhãn", note: null })).success);
  assert.ok(pageBlockInputSchema.safeParse(stats({ value: "1", label: "Nhãn", note: null, align: "right" })).success);
  assert.equal(pageBlockInputSchema.safeParse(stats({ value: "1", label: "Nhãn", note: null, align: "top" })).success, false);
});

test("Căn chữ riêng mở rộng sang câu hỏi, gói giá, nhóm danh sách và vị trí biểu tượng của thẻ", () => {
  const faq = (align: unknown) => ({ type: "faq", isEnabled: true, data: { eyebrow: null, title: "Hỏi đáp", items: [{ question: "Q", answer: "A", ...(align === undefined ? {} : { align }) }] } });
  assert.ok(pageBlockInputSchema.safeParse(faq(undefined)).success);
  assert.ok(pageBlockInputSchema.safeParse(faq("center")).success);
  assert.equal(pageBlockInputSchema.safeParse(faq("middle")).success, false);

  const plan = { name: "Gói", price: "Liên hệ", period: null, description: null, features: [], action: null, highlighted: false, badge: null };
  const pricing = (extra: object) => ({ type: "pricing", isEnabled: true, data: { eyebrow: null, title: "Giá", description: null, note: null, plans: [{ ...plan, ...extra }] } });
  assert.ok(pageBlockInputSchema.safeParse(pricing({})).success);
  assert.ok(pageBlockInputSchema.safeParse(pricing({ align: "right" })).success);
  assert.equal(pageBlockInputSchema.safeParse(pricing({ align: "up" })).success, false);

  const grouped = (extra: object) => ({ type: "grouped_list", isEnabled: true, data: { eyebrow: null, title: "Nhóm", description: null, groupLabel: null, showCount: false, groups: [{ title: "Nhóm 1", icon: null, items: [], action: null, ...extra }] } });
  assert.ok(pageBlockInputSchema.safeParse(grouped({ align: "center" })).success);

  const card = { title: "Thẻ", description: "", href: null };
  const features = (extra: object) => ({ type: "features", isEnabled: true, data: { eyebrow: null, title: "Lợi ích", description: null, items: [{ ...card, ...extra }] } });
  assert.ok(pageBlockInputSchema.safeParse(features({ iconPosition: "left" })).success);
  assert.equal(pageBlockInputSchema.safeParse(features({ iconPosition: "right" })).success, false);
});
