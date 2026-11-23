import assert from "node:assert/strict";
import test from "node:test";

import { auditSeo, type SeoAuditEntry } from "./seo-audit";
import { seoAuditResultSchema } from "./seo-audit.contract";

const goodDescription = "Phần mềm quản lý bán hàng cho nhà hàng, quán cà phê: gọi món, thanh toán, kho và báo cáo trên điện thoại.";
const entry = (overrides: Partial<SeoAuditEntry>): SeoAuditEntry => ({
  kind: "post", id: crypto.randomUUID(), type: "news", label: "Bài", path: "/news/bai", title: "Tiêu đề bài viết đủ dài cho Google | iOrder",
  description: goodDescription, hasImage: true, imageHasAlt: true, noindex: false, canonicalUrl: null, focusKeyword: null, ...overrides,
});

test("Nội dung đạt chuẩn không bị liệt kê", () => {
  const result = auditSeo([entry({})]);
  assert.equal(result.checked, 1);
  assert.deepEqual(result.rows, []);
});

test("Tiêu đề và mô tả trùng được báo ở cả hai phía, không phân biệt hoa thường/khoảng trắng", () => {
  const a = entry({ label: "A", path: "/news/a", title: "Giới thiệu iOrder | iOrder" });
  const b = entry({ label: "B", path: "/news/b", title: "giới thiệu  IORDER | iOrder", description: ` ${goodDescription.toUpperCase()} ` });
  const result = auditSeo([a, b, entry({ path: "/news/c", title: "Khác hẳn | iOrder", description: "Một mô tả khác hẳn, đủ dài để không bị coi là ngắn, nói về hóa đơn điện tử và chữ ký số." })]);
  assert.equal(result.rows.length, 2);
  for (const row of result.rows) {
    assert.deepEqual(row.issues.map((issue) => issue.code), ["duplicate_title", "duplicate_description"]);
  }
  assert.match(result.rows.find((row) => row.path === "/news/a")!.issues[0].message, /B \(\/news\/b\)/);
});

test("Thiếu mô tả không bị tính là trùng mô tả; trang không có ảnh bìa riêng thì bỏ qua kiểm ảnh", () => {
  const result = auditSeo([
    entry({ kind: "page", type: null, path: "/about", title: "Giới thiệu", description: null, hasImage: null }),
    entry({ kind: "page", type: null, path: "/contact", title: "Liên hệ", description: "  ", hasImage: null }),
  ]);
  for (const row of result.rows) assert.deepEqual(row.issues.map((issue) => issue.code), ["missing_description"]);
});

test("Độ dài và ảnh bìa; lỗi trùng xếp trước lỗi độ dài", () => {
  const long = entry({ path: "/news/dai", title: `${"Tiêu đề rất dài ".repeat(5)}| iOrder`, description: "x".repeat(161), hasImage: false });
  const short = entry({ path: "/news/ngan", title: "Ngắn | iOrder", description: "Mô tả ngắn." });
  const duplicate = [entry({ path: "/news/trung-1", title: "Trùng | iOrder" }), entry({ path: "/news/trung-2", title: "Trùng | iOrder" })];
  const result = auditSeo([long, short, ...duplicate]);
  assert.deepEqual(result.rows.find((row) => row.path === "/news/dai")!.issues.map((issue) => issue.code), ["title_long", "description_long", "missing_image"]);
  assert.deepEqual(result.rows.find((row) => row.path === "/news/ngan")!.issues.map((issue) => issue.code), ["description_short"]);
  assert.deepEqual(result.rows.slice(0, 2).map((row) => row.issues[0].code), ["duplicate_title", "duplicate_title"]);
  assert.equal(seoAuditResultSchema.safeParse(result).success, true);
});

test("Trang noindex chỉ báo noindex, không tính vào so sánh trùng lặp của trang khác", () => {
  const hidden = entry({ label: "Ẩn", path: "/news/an", title: "Trùng | iOrder", description: null, hasImage: false, noindex: true });
  const visible = entry({ label: "Hiện", path: "/news/hien", title: "Trùng | iOrder" });
  const result = auditSeo([hidden, visible]);
  assert.deepEqual(result.rows.map((row) => [row.path, row.issues.map((issue) => issue.code)]), [["/news/an", ["noindex"]]]);
  assert.equal(seoAuditResultSchema.safeParse(result).success, true);
});

test("Canonical khác tên miền hoặc khác trang bị báo; canonical về chính trang (kể cả thêm dấu /) thì không", () => {
  const siteUrl = "https://iorder.vn";
  const codes = (canonicalUrl: string | null) => auditSeo([entry({ canonicalUrl })], { siteUrl }).rows[0]?.issues.map((issue) => issue.code) ?? [];
  assert.deepEqual(codes("https://nguoi-khac.com/news/bai"), ["canonical_mismatch"]);
  assert.deepEqual(codes("https://iorder.vn/news/bai-khac"), ["canonical_mismatch"]);
  assert.deepEqual(codes("https://www.iorder.vn/news/bai"), ["canonical_mismatch"]);
  assert.deepEqual(codes("https://iorder.vn/news/bai/"), []);
  assert.deepEqual(codes("/news/bai"), []);
  assert.deepEqual(codes(null), []);
  // Chưa cấu hình địa chỉ website: không có gì để so, không đoán.
  assert.deepEqual(auditSeo([entry({ canonicalUrl: "https://nguoi-khac.com/x" })]).rows, []);
  assert.match(auditSeo([entry({ canonicalUrl: "https://nguoi-khac.com/x" })], { siteUrl }).rows[0].issues[0].message, /nguoi-khac.com/);
});

test("Ảnh bìa có nhưng thiếu alt bị báo sau lỗi thiếu ảnh; xếp sau lỗi canonical", () => {
  const result = auditSeo([entry({ path: "/news/a", title: "Bài A cho Google | iOrder", imageHasAlt: false }), entry({ path: "/news/b", title: "Bài B cho Google | iOrder", description: "Một mô tả khác hẳn, đủ dài để không bị coi là ngắn, nói về hóa đơn điện tử và chữ ký số.", imageHasAlt: false, canonicalUrl: "https://khac.vn/b" })], { siteUrl: "https://iorder.vn" });
  assert.deepEqual(result.rows.map((row) => row.issues.map((issue) => issue.code)), [["canonical_mismatch", "missing_image_alt"], ["missing_image_alt"]]);
});

test("Hai nội dung cùng từ khóa chính bị báo tranh nhau (không phân biệt hoa thường); noindex và từ khóa khác nhau thì không", () => {
  const a = entry({ label: "Bài A", path: "/news/a", title: "Bài A cho Google | iOrder", focusKeyword: "Phần mềm quản lý nhà hàng" });
  const b = entry({ label: "Bài B", path: "/news/b", title: "Bài B cho Google | iOrder", description: "Một mô tả khác hẳn, đủ dài để không bị coi là ngắn, nói về hóa đơn điện tử và chữ ký số.", focusKeyword: "phần mềm  QUẢN LÝ nhà hàng" });
  const c = entry({ label: "Bài C", path: "/news/c", title: "Bài C cho Google | iOrder", description: "Mô tả thứ ba cũng khác hẳn hai bài kia, nói về máy in hóa đơn nhiệt và cách kết nối với máy tính tiền.", focusKeyword: "máy in hóa đơn" });
  const hidden = entry({ label: "Bài ẩn", path: "/news/an", title: "Bài ẩn | iOrder", focusKeyword: "phần mềm quản lý nhà hàng", noindex: true });
  const result = auditSeo([a, b, c, hidden]);
  const conflicts = result.rows.filter((row) => row.issues.some((issue) => issue.code === "keyword_conflict"));
  assert.deepEqual(conflicts.map((row) => row.path).sort(), ["/news/a", "/news/b"]);
  assert.match(conflicts.find((row) => row.path === "/news/a")!.issues.find((issue) => issue.code === "keyword_conflict")!.message, /Bài B \(\/news\/b\)/);
  assert.ok(!conflicts.some((row) => row.label === "Bài ẩn"));
  assert.equal(seoAuditResultSchema.safeParse(result).success, true);
  // Từ khóa trống không bị coi là trùng nhau.
  assert.deepEqual(auditSeo([entry({ path: "/news/x", focusKeyword: null }), entry({ path: "/news/y", title: "Khác | iOrder", description: goodDescription + " Thêm.", focusKeyword: null })]).rows.filter((row) => row.issues.some((issue) => issue.code === "keyword_conflict")), []);
});

test("Nội dung tốt không có lỗi vẫn hiện trong healthy kèm điểm; bài có lỗi nằm ở rows, không nằm ở healthy", () => {
  const good = entry({ label: "Tốt", path: "/news/tot-ma-khong-loi", title: "Bài viết tốt không có lỗi nào | iOrder", body: { content: { blocks: [{ type: "paragraph", text: "từ ".repeat(320) }] } } });
  const bad = entry({ label: "Lỗi", path: "/news/loi", title: "Bài viết thiếu mô tả hoàn toàn | iOrder", description: null });
  const result = auditSeo([good, bad]);
  assert.deepEqual(result.rows.map((row) => row.label), ["Lỗi"]);
  assert.deepEqual(result.healthy.map((row) => row.label), ["Tốt"]);
  assert.ok(result.healthy[0].score.total > 0 && result.healthy[0].score.passed <= result.healthy[0].score.total);
  assert.equal(result.healthy[0].issues.length, 0);
  assert.equal("body" in result.healthy[0], false, "Thân bài chỉ để tính toán, không đưa ra kết quả");
  assert.doesNotThrow(() => seoAuditResultSchema.parse(JSON.parse(JSON.stringify({ ...result, rows: result.rows, healthy: result.healthy }))));
});

test("Bài viết có thân bài: báo bài ngắn, thiếu đề mục, ảnh trong bài thiếu alt; không có thân bài (trang, thiết bị) thì không báo", () => {
  const short = entry({ label: "Ngắn", path: "/news/ngan", body: { content: { blocks: [{ type: "paragraph", text: "chỉ vài từ" }] } } });
  const rowCodes = auditSeo([short]).rows[0].issues.map((issue) => issue.code);
  assert.ok(rowCodes.includes("content_short"));
  const noBody = auditSeo([entry({ kind: "equipment", type: null, path: "/equipment/may-pos" })]);
  assert.deepEqual(noBody.rows, []);
  assert.deepEqual(noBody.healthy[0].score, { passed: noBody.healthy[0].score.total, total: noBody.healthy[0].score.total });
});

test("Từ khóa chính chưa có trong tiêu đề thì báo keyword_weak; trang không có ảnh bìa riêng không bị trừ điểm vì thiếu ảnh", () => {
  const weak = auditSeo([entry({ label: "Từ khóa", path: "/news/tu-khoa", focusKeyword: "máy in bếp", body: { content: { blocks: [{ type: "paragraph", text: "từ ".repeat(320) }] } } })]);
  assert.ok(weak.rows[0].issues.some((issue) => issue.code === "keyword_weak"));
  const page = auditSeo([entry({ kind: "page", type: null, path: "/contact", hasImage: null, imageHasAlt: null })]);
  assert.equal(page.healthy[0].score.passed, page.healthy[0].score.total);
});
