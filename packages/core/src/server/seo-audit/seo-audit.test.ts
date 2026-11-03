import assert from "node:assert/strict";
import test from "node:test";

import { auditSeo, type SeoAuditEntry } from "./seo-audit";
import { seoAuditResultSchema } from "./seo-audit.contract";

const goodDescription = "Phần mềm quản lý bán hàng cho nhà hàng, quán cà phê: gọi món, thanh toán, kho và báo cáo trên điện thoại.";
const entry = (overrides: Partial<SeoAuditEntry>): SeoAuditEntry => ({
  kind: "post", id: crypto.randomUUID(), type: "news", label: "Bài", path: "/tin-tuc/bai", title: "Tiêu đề bài viết đủ dài cho Google | iOrder",
  description: goodDescription, hasImage: true, ...overrides,
});

test("Nội dung đạt chuẩn không bị liệt kê", () => {
  const result = auditSeo([entry({})]);
  assert.equal(result.checked, 1);
  assert.deepEqual(result.rows, []);
});

test("Tiêu đề và mô tả trùng được báo ở cả hai phía, không phân biệt hoa thường/khoảng trắng", () => {
  const a = entry({ label: "A", path: "/tin-tuc/a", title: "Giới thiệu iOrder | iOrder" });
  const b = entry({ label: "B", path: "/tin-tuc/b", title: "giới thiệu  IORDER | iOrder", description: ` ${goodDescription.toUpperCase()} ` });
  const result = auditSeo([a, b, entry({ path: "/tin-tuc/c", title: "Khác hẳn | iOrder", description: "Một mô tả khác hẳn, đủ dài để không bị coi là ngắn, nói về hóa đơn điện tử và chữ ký số." })]);
  assert.equal(result.rows.length, 2);
  for (const row of result.rows) {
    assert.deepEqual(row.issues.map((issue) => issue.code), ["duplicate_title", "duplicate_description"]);
  }
  assert.match(result.rows.find((row) => row.path === "/tin-tuc/a")!.issues[0].message, /B \(\/tin-tuc\/b\)/);
});

test("Thiếu mô tả không bị tính là trùng mô tả; trang không có ảnh bìa riêng thì bỏ qua kiểm ảnh", () => {
  const result = auditSeo([
    entry({ kind: "page", type: null, path: "/gioi-thieu", title: "Giới thiệu", description: null, hasImage: null }),
    entry({ kind: "page", type: null, path: "/lien-he", title: "Liên hệ", description: "  ", hasImage: null }),
  ]);
  for (const row of result.rows) assert.deepEqual(row.issues.map((issue) => issue.code), ["missing_description"]);
});

test("Độ dài và ảnh bìa; lỗi trùng xếp trước lỗi độ dài", () => {
  const long = entry({ path: "/tin-tuc/dai", title: `${"Tiêu đề rất dài ".repeat(5)}| iOrder`, description: "x".repeat(161), hasImage: false });
  const short = entry({ path: "/tin-tuc/ngan", title: "Ngắn | iOrder", description: "Mô tả ngắn." });
  const duplicate = [entry({ path: "/tin-tuc/trung-1", title: "Trùng | iOrder" }), entry({ path: "/tin-tuc/trung-2", title: "Trùng | iOrder" })];
  const result = auditSeo([long, short, ...duplicate]);
  assert.deepEqual(result.rows.find((row) => row.path === "/tin-tuc/dai")!.issues.map((issue) => issue.code), ["title_long", "description_long", "missing_image"]);
  assert.deepEqual(result.rows.find((row) => row.path === "/tin-tuc/ngan")!.issues.map((issue) => issue.code), ["description_short"]);
  assert.deepEqual(result.rows.slice(0, 2).map((row) => row.issues[0].code), ["duplicate_title", "duplicate_title"]);
  assert.equal(seoAuditResultSchema.safeParse(result).success, true);
});
