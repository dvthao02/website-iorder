import assert from "node:assert/strict";
import { test } from "node:test";
import { leadContextSchema, leadListPageSchema, leadListQuerySchema, leadMergeResponseSchema, leadMergeSchema, leadUpdateResponseSchema, leadUpdateSchema, publicLeadInputSchema } from "./leads.contract";

const id = "12345678-1234-4234-8234-123456789abc";
const time = "2026-10-09T00:00:00.000Z";

test("Phản hồi phân trang kiểm tổng, số hàng, ID trùng và ngày", () => {
  const empty = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1, counts: { all: 0, new: 0, contacted: 0, closed: 0 }, assignees: [] };
  assert.equal(leadListPageSchema.safeParse(empty).success, true);
  for (const patch of [{ total: 1 }, { totalPages: 2 }, { counts: { all: 1, new: 0, contacted: 0, closed: 0 } }, { pageSize: 101 }]) assert.equal(leadListPageSchema.safeParse({ ...empty, ...patch }).success, false);
  const row = { id, name: "Kiểm thử", phone: "0900000000", email: null, businessModel: null, branches: null, need: null, message: null, status: "new", createdAt: new Date(time), handledAt: null, context: null, internalNote: null, handledByName: null, sameCustomerCount: 1, assignedToId: null, assignedToName: null, assignedAt: null };
  const one = { ...empty, items: [row], total: 1, counts: { all: 1, new: 1, contacted: 0, closed: 0 } };
  assert.equal(leadListPageSchema.safeParse(one).success, true);
  assert.equal(leadListPageSchema.safeParse({ ...one, items: [{ ...row, createdAt: "sai" }] }).success, false);
  // Ghi chú, người xử lý và số liên hệ cùng số điện thoại (>= 1, kể cả chính nó).
  assert.equal(leadListPageSchema.safeParse({ ...one, items: [{ ...row, internalNote: "Đã gọi", handledByName: "Nhân viên A", sameCustomerCount: 3 }] }).success, true);
  for (const patch of [{ sameCustomerCount: 0 }, { sameCustomerCount: 1.5 }, { internalNote: 5 }, { handledByName: 5 }]) assert.equal(leadListPageSchema.safeParse({ ...one, items: [{ ...row, ...patch }] }).success, false, JSON.stringify(patch));
  // Người phụ trách (id + tên + giờ giao) và danh sách nhân viên có thể được giao.
  assert.equal(leadListPageSchema.safeParse({ ...one, items: [{ ...row, assignedToId: id, assignedToName: "Chị Lan", assignedAt: new Date(time) }], assignees: [{ id, name: "Chị Lan" }] }).success, true);
  for (const patch of [{ assignedToId: "sai" }, { assignedToId: 5 }, { assignedAt: "2026-10-09" }]) assert.equal(leadListPageSchema.safeParse({ ...one, items: [{ ...row, ...patch }] }).success, false, JSON.stringify(patch));
  assert.equal(leadListPageSchema.safeParse({ ...one, assignees: [{ id: "sai", name: "A" }] }).success, false);
  assert.equal(leadListPageSchema.safeParse({ ...one, items: [row, row], total: 2, counts: { all: 2, new: 2, contacted: 0, closed: 0 } }).success, false);
});

test("Bộ lọc Leads có mặc định, giới hạn và chuẩn hóa từ khóa khi parse", () => {
  assert.deepEqual(leadListQuerySchema.parse({}), { page: 1, pageSize: 25, query: "", status: "all", source: "all", assignee: "all", focus: "all" });
  assert.deepEqual(leadListQuerySchema.parse({ page: "2", pageSize: "5", query: "  Tiếng Việt  ", status: "new", source: "equipment" }), { page: 2, pageSize: 5, query: "Tiếng Việt", status: "new", source: "equipment", assignee: "all", focus: "all" });
  // Chỉ hiện: tất cả, liên hệ mới chờ quá hạn, khách gửi nhiều lần.
  for (const focus of ["all", "overdue", "repeat"]) assert.equal(leadListQuerySchema.parse({ focus }).focus, focus);
  for (const focus of ["", "late", "OVERDUE"]) assert.equal(leadListQuerySchema.safeParse({ focus }).success, false, focus);
  // Người phụ trách: mọi người, của tôi, chưa giao hoặc một tài khoản cụ thể.
  for (const assignee of ["all", "me", "unassigned", id]) assert.equal(leadListQuerySchema.parse({ assignee }).assignee, assignee);
  for (const assignee of ["nguoi-khac", "", "ME"]) assert.equal(leadListQuerySchema.safeParse({ assignee }).success, false, assignee);
  assert.equal(leadListQuerySchema.parse({ source: "general" }).source, "general");
  for (const value of [{ page: 0 }, { page: 1.5 }, { pageSize: 101 }, { pageSize: 4 }, { status: "deleted" }, { source: "khac" }, { query: "a".repeat(161) }, { unknown: true }]) assert.equal(leadListQuerySchema.safeParse(value).success, false);
});

test("Cập nhật liên hệ nhận trạng thái, ghi chú và/hoặc người phụ trách, không nhận trường lạ", () => {
  for (const status of ["new", "contacted", "closed"]) assert.equal(leadUpdateSchema.safeParse({ status }).success, true);
  for (const value of [{}, { status: "deleted" }, { status: "new", handledBy: id }, { handledAt: time }]) assert.equal(leadUpdateSchema.safeParse(value).success, false, JSON.stringify(value));
  // Ghi chú: cắt khoảng trắng, rỗng hoặc null là xóa ghi chú, tối đa 2.000 ký tự; đi riêng hoặc cùng trạng thái.
  assert.deepEqual(leadUpdateSchema.parse({ internalNote: "  Đã gọi, hẹn chiều  " }), { internalNote: "Đã gọi, hẹn chiều" });
  assert.deepEqual(leadUpdateSchema.parse({ internalNote: "   " }), { internalNote: null });
  assert.deepEqual(leadUpdateSchema.parse({ internalNote: null }), { internalNote: null });
  assert.deepEqual(leadUpdateSchema.parse({ status: "contacted", internalNote: "Gọi lại" }), { status: "contacted", internalNote: "Gọi lại" });
  assert.equal(leadUpdateSchema.safeParse({ internalNote: "x".repeat(2_000) }).success, true);
  // Người phụ trách: giao cho một tài khoản, hoặc null là bỏ giao; đi riêng hoặc cùng trạng thái/ghi chú.
  assert.deepEqual(leadUpdateSchema.parse({ assignedTo: id }), { assignedTo: id });
  assert.deepEqual(leadUpdateSchema.parse({ assignedTo: null }), { assignedTo: null });
  assert.deepEqual(leadUpdateSchema.parse({ status: "contacted", assignedTo: id }), { status: "contacted", assignedTo: id });
  for (const value of [{ assignedTo: "me" }, { assignedTo: "" }, { assignedTo: 5 }, { assignedTo: undefined }]) assert.equal(leadUpdateSchema.safeParse(value).success, false, JSON.stringify(value));
  for (const value of [{ internalNote: "x".repeat(2_001) }, { internalNote: 5 }, { internalNote: undefined }]) assert.equal(leadUpdateSchema.safeParse(value).success, false, JSON.stringify(value));
});
const person = { name: "Nguyễn Văn A", phone: "0912345678", email: null };
test("Phản hồi thời gian xử lý khớp trạng thái", () => {
  assert.deepEqual(leadUpdateResponseSchema.parse({ id, status: "new", handledAt: null, internalNote: null, assignedToId: null, ...person }), { id, status: "new", handledAt: null, internalNote: null, assignedToId: null, ...person });
  for (const status of ["contacted", "closed"]) assert.equal(leadUpdateResponseSchema.safeParse({ id, status, handledAt: time, internalNote: "Đã gọi", assignedToId: id, ...person }).success, true);
  for (const value of [{ status: "new", handledAt: time }, { status: "contacted", handledAt: null }, { status: "closed", handledAt: null }]) {
    assert.equal(leadUpdateResponseSchema.safeParse({ id, internalNote: null, assignedToId: null, ...person, ...value }).success, false);
  }
});
test("Phản hồi từ chối ID/trạng thái/ngày sai và không mang trường DB phụ", () => {
  for (const patch of [{ id: "sai" }, { status: "deleted" }, { handledAt: "ngày sai" }, { handledAt: "2026-10-09" }]) {
    assert.equal(leadUpdateResponseSchema.safeParse({ id, status: "contacted", handledAt: time, internalNote: null, assignedToId: null, ...person, ...patch }).success, false);
  }
  const source = { id, status: "contacted", handledAt: time, internalNote: null, assignedToId: null, ...person, ipHash: "fixture", handledBy: id };
  assert.deepEqual(leadUpdateResponseSchema.parse(source), { id, status: "contacted", handledAt: time, internalNote: null, assignedToId: null, ...person });
  assert.equal(source.ipHash, "fixture");
});

test("Sửa thông tin khách: họ tên, số điện thoại (chuẩn hóa), email; đi riêng hoặc cùng trạng thái", () => {
  assert.deepEqual(leadUpdateSchema.parse({ name: "  Lê Thị B  " }), { name: "Lê Thị B" });
  // Số điện thoại theo quy tắc chung: +84 thay số 0 đầu, lưu dạng chữ số.
  assert.deepEqual(leadUpdateSchema.parse({ phone: "+84 912 345 678" }), { phone: "0912345678" });
  assert.deepEqual(leadUpdateSchema.parse({ email: "  a@iorder.vn " }), { email: "a@iorder.vn" });
  assert.deepEqual(leadUpdateSchema.parse({ email: "" }), { email: null });
  assert.deepEqual(leadUpdateSchema.parse({ email: null }), { email: null });
  assert.deepEqual(leadUpdateSchema.parse({ status: "contacted", name: "Lê Thị B", phone: "0912345678" }), { status: "contacted", name: "Lê Thị B", phone: "0912345678" });
  for (const value of [{ name: "A" }, { name: "x".repeat(181) }, { phone: "091234567" }, { phone: "0909090909" }, { phone: "+1 202 555 0143" }, { phone: "" }, { email: "khong-phai-email" }, { name: undefined }]) {
    assert.equal(leadUpdateSchema.safeParse(value).success, false, JSON.stringify(value));
  }
});

test("Gộp liên hệ nhận 2–20 mã khác nhau, phản hồi nêu liên hệ giữ lại", () => {
  const other = "22345678-1234-4234-8234-123456789abc";
  assert.deepEqual(leadMergeSchema.parse({ ids: [id, other] }), { ids: [id, other] });
  assert.equal(leadMergeSchema.safeParse({ ids: Array.from({ length: 20 }, (_, index) => `${String(index).padStart(8, "0")}-1234-4234-8234-123456789abc`) }).success, true);
  for (const value of [{}, { ids: [] }, { ids: [id] }, { ids: [id, id] }, { ids: [id, "sai"] }, { ids: [id, other], extra: 1 }, { ids: Array.from({ length: 21 }, (_, index) => `${String(index).padStart(8, "0")}-1234-4234-8234-123456789abc`) }]) {
    assert.equal(leadMergeSchema.safeParse(value).success, false, JSON.stringify(value).slice(0, 80));
  }
  assert.deepEqual(leadMergeResponseSchema.parse({ keptId: id, mergedCount: 2 }), { keptId: id, mergedCount: 2 });
  for (const value of [{ keptId: id, mergedCount: 0 }, { keptId: "sai", mergedCount: 1 }, { keptId: id }]) assert.equal(leadMergeResponseSchema.safeParse(value).success, false);
});

test("Liên hệ công khai: chỉ họ tên và số điện thoại bắt buộc, trường vắng hoặc để trống thành null", () => {
  const empty = { businessModel: null, branches: null, need: null, message: null, email: null };
  // Đúng dữ liệu biểu mẫu website gửi: không có businessModel/branches, ô trống là chuỗi rỗng.
  assert.deepEqual(publicLeadInputSchema.parse({ name: "Nguyễn Văn A", phone: "0901 234 567", email: "", need: "", website: "", message: "" }), { ...empty, name: "Nguyễn Văn A", phone: "0901234567", website: "" });
  // Chỉ hai trường bắt buộc.
  assert.deepEqual(publicLeadInputSchema.parse({ name: "Nguyễn Văn A", phone: "0901234567" }), { ...empty, name: "Nguyễn Văn A", phone: "0901234567" });
  const full = publicLeadInputSchema.parse({ name: "A B", phone: "0901234567", email: "a@iorder.vn", businessModel: " Quán cà phê ", branches: "3", need: "Quản lý kho", message: "Cần tư vấn" });
  assert.deepEqual([full.email, full.businessModel, full.branches, full.need, full.message], ["a@iorder.vn", "Quán cà phê", "3", "Quản lý kho", "Cần tư vấn"]);
});

test("Liên hệ công khai: từ chối thiếu họ tên/số điện thoại, định dạng sai và trường lạ", () => {
  const base = { name: "Nguyễn Văn A", phone: "0901234567" };
  for (const patch of [{ name: "" }, { name: "A" }, { phone: "" }, { phone: "1234567" }, { phone: "090-abc-1234" }, { email: "khong-phai-email" }, { status: "closed" }, { message: "x".repeat(2_001) }, { need: "x".repeat(201) }]) {
    assert.equal(publicLeadInputSchema.safeParse({ ...base, ...patch }).success, false, JSON.stringify(patch));
  }
  for (const missing of ["name", "phone"] as const) {
    const rest = Object.fromEntries(Object.entries(base).filter(([key]) => key !== missing));
    assert.equal(publicLeadInputSchema.safeParse(rest).success, false, missing);
  }
});

test("Liên hệ công khai: chặn số điện thoại bịa, họ tên là đường dẫn/chuỗi số và lời nhắn nhiều liên kết", () => {
  const base = { name: "Nguyễn Văn A", phone: "0912345678" };
  for (const patch of [{ phone: "0000000000" }, { phone: "0909090909" }, { phone: "091234567" }, { phone: "091234567890" }, { phone: "+1 202 555 0143" }, { name: "http://spam.example" }, { name: "kiemtien.xyz" }, { name: "12345" }, { message: "http://a.example và https://b.example" }, { message: "www.a.vn www.b.vn" }]) {
    assert.equal(publicLeadInputSchema.safeParse({ ...base, ...patch }).success, false, JSON.stringify(patch));
  }
  // Một liên kết (ví dụ trang thiết bị khách đang xem) vẫn được.
  assert.equal(publicLeadInputSchema.safeParse({ ...base, message: "Tôi xem https://iorder.vn/equipment/may-pos-x1" }).success, true);
});

test("Liên hệ công khai: nhận mã thiết bị, mã phiên và ô bẫy; mã thiết bị phải là slug hợp lệ", () => {
  const base = { name: "Nguyễn Văn A", phone: "0912345678" };
  const parsed = publicLeadInputSchema.parse({ ...base, equipmentSlug: "may-pos-x1", token: "1.abc", website: "" });
  assert.deepEqual([parsed.equipmentSlug, parsed.token, parsed.website], ["may-pos-x1", "1.abc", ""]);
  // Ô bẫy có chữ vẫn qua kiểm tra dữ liệu: leads.service.ts nhận như bình thường nhưng không lưu.
  assert.equal(publicLeadInputSchema.safeParse({ ...base, website: "https://spam.example" }).success, true);
  for (const equipmentSlug of ["", "May POS", "may_pos", "-may", "may-", "../x", "a".repeat(181)]) assert.equal(publicLeadInputSchema.safeParse({ ...base, equipmentSlug }).success, false, equipmentSlug);
});

test("Ngữ cảnh thiết bị của liên hệ có schema chặt, ngày giờ ISO và tình trạng hàng hợp lệ", () => {
  const context = { kind: "equipment", equipmentId: id, slug: "may-pos-x1", name: "Máy POS X1", modelCode: null, brand: null, groupName: "Máy POS", priceVnd: 12500000, availability: "limited", capturedAt: time };
  assert.equal(leadContextSchema.safeParse(context).success, true);
  for (const patch of [{ kind: "post" }, { equipmentId: "sai" }, { priceVnd: -1 }, { priceVnd: 1.5 }, { availability: "unknown" }, { capturedAt: "hôm qua" }, { extra: 1 }]) assert.equal(leadContextSchema.safeParse({ ...context, ...patch }).success, false, JSON.stringify(patch));
});

test("Liên hệ công khai: +84 thay cho số 0 đầu và số điện thoại được lưu dạng chữ số 10–11 số", () => {
  const phoneOf = (phone: string) => publicLeadInputSchema.parse({ name: "Nguyễn Văn A", phone }).phone;
  for (const raw of ["0912345678", "0912 345 678", "+84 912 345 678", "+84-912-345-678", "84912345678", "+84 (0) 912 345 678"]) assert.equal(phoneOf(raw), "0912345678", raw);
  assert.equal(phoneOf("+84 28 7107 3999"), "02871073999");
  assert.equal(phoneOf("028.7107.3999"), "02871073999");
});
