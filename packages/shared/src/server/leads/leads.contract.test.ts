import assert from "node:assert/strict";
import { test } from "node:test";
import { leadListPageSchema, leadListQuerySchema, leadStatusUpdateResponseSchema, leadStatusUpdateSchema, publicLeadInputSchema } from "./leads.contract";

const id = "12345678-1234-4234-8234-123456789abc";
const time = "2026-10-09T00:00:00.000Z";

test("Phản hồi phân trang kiểm tổng, số hàng, ID trùng và ngày", () => {
  const empty = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1, counts: { all: 0, new: 0, contacted: 0, closed: 0 } };
  assert.equal(leadListPageSchema.safeParse(empty).success, true);
  for (const patch of [{ total: 1 }, { totalPages: 2 }, { counts: { all: 1, new: 0, contacted: 0, closed: 0 } }, { pageSize: 101 }]) assert.equal(leadListPageSchema.safeParse({ ...empty, ...patch }).success, false);
  const row = { id, name: "Kiểm thử", phone: "0900000000", email: null, businessModel: null, branches: null, need: null, message: null, status: "new", createdAt: new Date(time), handledAt: null };
  const one = { ...empty, items: [row], total: 1, counts: { all: 1, new: 1, contacted: 0, closed: 0 } };
  assert.equal(leadListPageSchema.safeParse(one).success, true);
  assert.equal(leadListPageSchema.safeParse({ ...one, items: [{ ...row, createdAt: "sai" }] }).success, false);
  assert.equal(leadListPageSchema.safeParse({ ...one, items: [row, row], total: 2, counts: { all: 2, new: 2, contacted: 0, closed: 0 } }).success, false);
});

test("Bộ lọc Leads có mặc định, giới hạn và chuẩn hóa từ khóa khi parse", () => {
  assert.deepEqual(leadListQuerySchema.parse({}), { page: 1, pageSize: 25, query: "", status: "all" });
  assert.deepEqual(leadListQuerySchema.parse({ page: "2", pageSize: "5", query: "  Tiếng Việt  ", status: "new" }), { page: 2, pageSize: 5, query: "Tiếng Việt", status: "new" });
  for (const value of [{ page: 0 }, { page: 1.5 }, { pageSize: 101 }, { pageSize: 4 }, { status: "deleted" }, { query: "a".repeat(161) }, { unknown: true }]) assert.equal(leadListQuerySchema.safeParse(value).success, false);
});

test("Trạng thái cập nhật chỉ nhận new/contacted/closed, không nhận trường lạ", () => {
  for (const status of ["new", "contacted", "closed"]) assert.equal(leadStatusUpdateSchema.safeParse({ status }).success, true);
  for (const value of [{}, { status: "deleted" }, { status: "new", handledBy: id }]) assert.equal(leadStatusUpdateSchema.safeParse(value).success, false);
});
test("Phản hồi thời gian xử lý khớp trạng thái", () => {
  assert.deepEqual(leadStatusUpdateResponseSchema.parse({ id, status: "new", handledAt: null }), { id, status: "new", handledAt: null });
  for (const status of ["contacted", "closed"]) assert.equal(leadStatusUpdateResponseSchema.safeParse({ id, status, handledAt: time }).success, true);
  for (const value of [{ status: "new", handledAt: time }, { status: "contacted", handledAt: null }, { status: "closed", handledAt: null }]) {
    assert.equal(leadStatusUpdateResponseSchema.safeParse({ id, ...value }).success, false);
  }
});
test("Phản hồi từ chối ID/trạng thái/ngày sai và không mang trường DB phụ", () => {
  for (const patch of [{ id: "sai" }, { status: "deleted" }, { handledAt: "ngày sai" }, { handledAt: "2026-10-09" }]) {
    assert.equal(leadStatusUpdateResponseSchema.safeParse({ id, status: "contacted", handledAt: time, ...patch }).success, false);
  }
  const source = { id, status: "contacted", handledAt: time, ipHash: "fixture", handledBy: id };
  assert.deepEqual(leadStatusUpdateResponseSchema.parse(source), { id, status: "contacted", handledAt: time });
  assert.equal(source.ipHash, "fixture");
});

test("Liên hệ công khai: chỉ họ tên và số điện thoại bắt buộc, trường vắng hoặc để trống thành null", () => {
  const empty = { businessModel: null, branches: null, need: null, message: null, email: null };
  // Đúng dữ liệu biểu mẫu website gửi: không có businessModel/branches, ô trống là chuỗi rỗng.
  assert.deepEqual(publicLeadInputSchema.parse({ name: "Nguyễn Văn A", phone: "0901 234 567", email: "", need: "", website: "", message: "" }), { ...empty, name: "Nguyễn Văn A", phone: "0901 234 567", website: "" });
  // Chỉ hai trường bắt buộc.
  assert.deepEqual(publicLeadInputSchema.parse({ name: "Nguyễn Văn A", phone: "0901234567" }), { ...empty, name: "Nguyễn Văn A", phone: "0901234567" });
  const full = publicLeadInputSchema.parse({ name: "A B", phone: "0901234567", email: "a@iorder.vn", businessModel: " Quán cà phê ", branches: "3", need: "Quản lý kho", message: "Cần tư vấn" });
  assert.deepEqual([full.email, full.businessModel, full.branches, full.need, full.message], ["a@iorder.vn", "Quán cà phê", "3", "Quản lý kho", "Cần tư vấn"]);
});

test("Liên hệ công khai: từ chối thiếu họ tên/số điện thoại, định dạng sai, ô bẫy bot có nội dung và trường lạ", () => {
  const base = { name: "Nguyễn Văn A", phone: "0901234567" };
  for (const patch of [{ name: "" }, { name: "A" }, { phone: "" }, { phone: "1234567" }, { phone: "090-abc-1234" }, { email: "khong-phai-email" }, { website: "https://spam.example" }, { status: "closed" }, { message: "x".repeat(5_001) }, { need: "x".repeat(201) }]) {
    assert.equal(publicLeadInputSchema.safeParse({ ...base, ...patch }).success, false, JSON.stringify(patch));
  }
  for (const missing of ["name", "phone"] as const) {
    const { [missing]: _removed, ...rest } = base;
    assert.equal(publicLeadInputSchema.safeParse(rest).success, false, missing);
  }
});
