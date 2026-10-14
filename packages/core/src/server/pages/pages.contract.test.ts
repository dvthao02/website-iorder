import assert from "node:assert/strict";
import test from "node:test";
import { adminPagesPageSchema, pageListQuerySchema, pageSaveRequestSchema } from "./pages.contract";
import { publicationDate } from "../shared/publication-date";
import { assertPageVersion, PageVersionConflictError } from "./page-version";

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
  for (const bad of [{ page: 0 }, { pageSize: 101 }, { status: "sai" }, { unknown: true }]) assert.equal(pageListQuerySchema.safeParse(bad).success, false);
});
