import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSavedNavigationDocument } from "./navigation.contract";

const id = "12345678-1234-4234-8234-123456789abc";
const previous = { id, location: "header" as const, version: 2 };
const saved = { ...previous, version: 3, items: [] };
test("Phản hồi lưu menu chỉ nhận đúng ID/vị trí/phiên bản tiếp theo", () => {
  assert.deepEqual(parseSavedNavigationDocument(saved, previous), saved);
  for (const patch of [{ id: null }, { id: "12345678-1234-4234-8234-123456789abd" }, { location: "footer" }, { version: 2 }, { version: 4 }, { items: "sai" }]) assert.equal(parseSavedNavigationDocument({ ...saved, ...patch }, previous), undefined);
  assert.equal(parseSavedNavigationDocument(null, previous), undefined);
});
test("Tạo menu nhận ID mới nhưng vẫn phải đúng location và version", () => {
  assert.deepEqual(parseSavedNavigationDocument({ ...saved, version: 1 }, { ...previous, id: null, version: 0 }), { ...saved, version: 1 });
  assert.equal(parseSavedNavigationDocument({ ...saved, version: 3 }, { ...previous, id: null, version: 0 }), undefined);
});
