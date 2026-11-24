import assert from "node:assert/strict";
import { test } from "node:test";

import { leadListPageSchema } from "@iorder/shared/server/leads/leads.contract";
import { reviveDates } from "./revive-dates";

test("Khóa kết thúc bằng At/Date thành Date, kể cả lồng nhau; khóa khác giữ nguyên chuỗi", () => {
  const revived = reviveDates({ createdAt: "2026-11-23T12:00:00.000Z", name: "2026-11-23T12:00:00.000Z", nested: { updatedAt: "2026-11-23T12:00:00.000Z" }, list: [{ publishDate: "2026-11-23" }], bad: { createdAt: "không phải ngày" } }) as {
    createdAt: unknown; name: unknown; nested: { updatedAt: unknown }; list: Array<{ publishDate: unknown }>; bad: { createdAt: unknown };
  };
  assert.ok(revived.createdAt instanceof Date);
  assert.equal(revived.name, "2026-11-23T12:00:00.000Z");
  assert.ok(revived.nested.updatedAt instanceof Date);
  assert.ok(revived.list[0].publishDate instanceof Date);
  assert.equal(revived.bad.createdAt, "không phải ngày");
});

// CMS nhận danh sách liên hệ qua đúng đường này: JSON từ Backend → reviveDates → hợp đồng. Từng lỗi vì capturedAt (trong ngữ cảnh thiết bị) bị
// reviveDates đổi thành Date trong khi hợp đồng chỉ nhận chuỗi, làm cả màn Khách hàng tiềm năng không tải được.
test("Danh sách liên hệ có ngữ cảnh thiết bị vẫn qua hợp đồng sau khi CMS đọc JSON", () => {
  const row = {
    id: "12345678-1234-4234-8234-123456789abc", name: "Nguyễn Văn A", phone: "0912345678", email: null, businessModel: null, branches: null,
    need: "Mua thiết bị: Máy POS X1", message: null, status: "new", createdAt: "2026-11-23T12:21:11.284Z", handledAt: null, internalNote: "Đã gọi, hẹn chiều", handledByName: null, sameCustomerCount: 2, assignedToId: "22345678-1234-4234-8234-123456789abc", assignedToName: "Chị Lan", assignedAt: "2026-11-23T13:00:00.000Z",
    context: { kind: "equipment", equipmentId: "e25bfbbb-9961-41e5-886c-74b5ddeb17a2", slug: "may-pos-x1", name: "Máy POS X1", brand: null, modelCode: "X1", groupName: "Máy POS", priceVnd: 5_590_000, availability: "out_of_stock", capturedAt: "2026-11-23T12:21:11.284Z" },
  };
  const page = { items: [row, { ...row, id: "22345678-1234-4234-8234-123456789abc", context: null }], page: 1, pageSize: 25, total: 2, totalPages: 1, counts: { all: 2, new: 2, contacted: 0, closed: 0 }, assignees: [{ id: "22345678-1234-4234-8234-123456789abc", name: "Chị Lan" }] };
  const parsed = leadListPageSchema.safeParse(reviveDates(JSON.parse(JSON.stringify(page))));
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  if (parsed.success) {
    assert.equal(parsed.data.items[0].context?.capturedAt, "2026-11-23T12:21:11.284Z");
    assert.equal(typeof parsed.data.items[0].context?.capturedAt, "string");
    assert.equal(parsed.data.items[1].context, null);
  }
});
