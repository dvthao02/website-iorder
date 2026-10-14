import assert from "node:assert/strict";
import { test } from "node:test";
import { partnerInputSchema, partnerListPageSchema, partnerListQuerySchema, supportingSaveResponseSchema, testimonialListPageSchema, testimonialListQuerySchema } from "./supporting.contract";

test("Danh sách thương hiệu có giới hạn và mặc định chung, giữ riêng loại đối tác", () => {
  assert.deepEqual(partnerListQuerySchema.parse({}), { page: 1, pageSize: 25, query: "", visibility: "all", partnerKind: "all" });
  assert.deepEqual(testimonialListQuerySchema.parse({}), { page: 1, pageSize: 25, query: "", visibility: "all" });
  const input = { page: "2", pageSize: "5", query: "  Đối tác Việt  ", visibility: "disabled", partnerKind: "customer" };
  assert.deepEqual(partnerListQuerySchema.parse(input), { page: 2, pageSize: 5, query: "Đối tác Việt", visibility: "disabled", partnerKind: "customer" });
  assert.equal(input.query, "  Đối tác Việt  ");
  assert.equal(testimonialListQuerySchema.safeParse(input).success, false);
});

test("Bộ lọc từ chối trường lạ, trạng thái và phân trang ngoài giới hạn", () => {
  for (const schema of [partnerListQuerySchema, testimonialListQuerySchema]) {
    for (const input of [{ page: 0 }, { page: 1.5 }, { pageSize: 4 }, { pageSize: 101 }, { visibility: "deleted" }, { query: "a".repeat(161) }, { unknown: true }]) {
      assert.equal(schema.safeParse(input).success, false);
    }
    for (const visibility of ["all", "enabled", "disabled"]) assert.equal(schema.safeParse({ visibility }).success, true);
  }
  assert.equal(partnerListQuerySchema.safeParse({ partnerKind: "testimonials" }).success, false);
});

test("Phản hồi thương hiệu kiểm số hàng/tổng/trùng ID và chỉ giữ trường editor", () => {
  const id = "12345678-1234-4234-8234-123456789abc";
  const empty = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 };
  for (const schema of [partnerListPageSchema, testimonialListPageSchema]) {
    assert.equal(schema.safeParse(empty).success, true);
    for (const patch of [{ total: 1 }, { totalPages: 2 }, { pageSize: 101 }, { total: -1 }]) assert.equal(schema.safeParse({ ...empty, ...patch }).success, false);
  }
  const partner = { id, logoMediaId: null, kind: "partner", name: "Đối tác", description: null, websiteUrl: null, sortOrder: 0, isEnabled: true, logo: null };
  const testimonial = { id, avatarMediaId: null, authorName: "Tác giả", authorRole: null, company: null, quote: "Nội dung", rating: 5, sortOrder: 0, isEnabled: true, avatar: null };
  assert.deepEqual(partnerListPageSchema.parse({ ...empty, total: 1, items: [{ ...partner, deletedAt: "fixture" }] }).items, [partner]);
  assert.deepEqual(testimonialListPageSchema.parse({ ...empty, total: 1, items: [testimonial] }).items, [testimonial]);
  assert.equal(partnerListPageSchema.safeParse({ ...empty, total: 2, items: [partner, partner] }).success, false);
  assert.equal(testimonialListPageSchema.safeParse({ ...empty, total: 2, items: [testimonial, testimonial] }).success, false);
});

test("Submit chuẩn hóa text mà không sửa bản nhập, phản hồi lưu bắt buộc UUID", () => {
  const input = { logoMediaId: null, kind: "partner", name: "  Đối tác Việt  ", description: " Mô tả  ", websiteUrl: null, sortOrder: 0, isEnabled: true };
  const saved = partnerInputSchema.parse(input);
  assert.equal(saved.name, "Đối tác Việt");
  assert.equal(saved.description, "Mô tả");
  assert.equal(input.name, "  Đối tác Việt  ");
  for (const id of ["", "khong-phai-id", null, 123]) assert.equal(supportingSaveResponseSchema.safeParse({ id }).success, false);
  assert.equal(supportingSaveResponseSchema.safeParse({ id: "12345678-1234-4234-8234-123456789abc" }).success, true);
});
