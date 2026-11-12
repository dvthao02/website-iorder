import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { parseAdminDetailPayload, parseDeletedEntityId, parseSavedEntityId, parseSavedEntityVersion, validateContentStateResponse } from "./admin-detail-payload";

test("archive/restore kiểm đúng entity, trạng thái và phiên bản theo contract từng module", () => {
  const id = "12345678-1234-4123-8123-123456789012";
  for (const action of ["archive", "restore"] as const) {
    for (const [resource, key] of [["posts", "post"], ["offerings", "offering"], ["pages", "page"]]) {
      const url = `/api/admin/${resource}${resource === "pages" ? "" : `/${id}?type=software`}`;
      const body = { id, expectedVersion: 3 };
      const item = { id, draftVersion: 4, status: action === "archive" ? "archived" : "draft" };
      assert.doesNotThrow(() => validateContentStateResponse({ [key]: item }, url, body, action));
      for (const wrong of [null, {}, { [key]: { ...item, id: "87654321-1234-4123-8123-123456789012" } }, { [key]: { ...item, draftVersion: 3 } }, { [key]: { ...item, draftVersion: 5 } }, { [key]: { ...item, status: "published" } }]) {
        assert.throws(() => validateContentStateResponse(wrong, url, body, action));
      }
    }
    assert.doesNotThrow(() => validateContentStateResponse({ id, version: 4 }, "/api/admin/equipment", { id, expectedVersion: 3 }, action));
    assert.throws(() => validateContentStateResponse({ id, version: 3 }, "/api/admin/equipment", { id, expectedVersion: 3 }, action));
    assert.throws(() => validateContentStateResponse({ id, version: 4 }, "/api/admin/equipment", { id }, action));
    const item = { id, status: action === "archive" ? "archived" : "draft", version: 4 };
    assert.doesNotThrow(() => validateContentStateResponse({ equipment: item }, `/api/admin/equipment/${id}`, { action, expectedVersion: 3 }, action));
    for (const wrong of [null, {}, { equipment: { ...item, id: "87654321-1234-4123-8123-123456789012" } }, { equipment: { ...item, status: "published" } }, { equipment: { ...item, version: 3 } }]) {
      assert.throws(() => validateContentStateResponse(wrong, `/api/admin/equipment/${id}`, { action, expectedVersion: 3 }, action));
    }
  }
});

test("xóa chỉ xác nhận ID khớp URL, không nhận JSON thiếu hoặc ID khác", () => {
  const id = "12345678-1234-4123-8123-123456789012";
  for (const resource of ["posts", "offerings", "pages", "equipment"]) {
    const url = `/api/admin/${resource}/${id}?expectedVersion=3`;
    assert.equal(parseDeletedEntityId({ deletedId: id }, url), id);
    for (const payload of [null, {}, { deletedId: 12 }, { deletedId: "invalid" }, { deletedId: "87654321-1234-4123-8123-123456789012" }]) {
      assert.throws(() => parseDeletedEntityId(payload, url), /Chưa xác nhận/);
    }
  }
  assert.throws(() => parseDeletedEntityId({ deletedId: id }, "/api/admin/pages"));
});

test("version phản hồi phải đúng bước tạo mới/cập nhật, không nhận version cũ hoặc nhảy bước", () => {
  assert.equal(parseSavedEntityVersion({ version: 1 }, 1), 1);
  assert.equal(parseSavedEntityVersion({ version: 4 }, 4), 4);
  for (const version of [undefined, "4", 0, -1, 1.5, 3, 5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parseSavedEntityVersion({ version }, 4));
  for (const expected of [0, NaN, Infinity, 1.5]) assert.throws(() => parseSavedEntityVersion({ version: 1 }, expected));
});

test("phản hồi lưu chỉ điều hướng bằng UUID hợp lệ và đúng entity đang sửa", () => {
  const id = "12345678-1234-4123-8123-123456789012";
  assert.equal(parseSavedEntityId({ id }), id);
  assert.equal(parseSavedEntityId({ id }, id), id);
  for (const payload of [null, {}, { id: "" }, { id: "../other" }, { id: 123 }, { id: "not-a-uuid" }]) assert.throws(() => parseSavedEntityId(payload));
  assert.throws(() => parseSavedEntityId({ id: "87654321-1234-4123-8123-123456789012" }, id));
});

test("detail kiểm schema và ID trước khi mở editor", () => {
  const schema = z.object({ id: z.string().uuid(), updatedAt: z.date() });
  const id = "12345678-1234-4123-8123-123456789012";
  const item = { id, updatedAt: new Date("2026-10-11T00:00:00Z") };
  for (const key of ["post", "offering", "page"]) {
    assert.deepEqual(parseAdminDetailPayload({ [key]: item }, key, schema, id), item);
    for (const payload of [null, {}, { [key]: null }, { [key]: { ...item, updatedAt: "sai" } }, { [key]: { ...item, id: "87654321-1234-4123-8123-123456789012" } }]) {
      assert.throws(() => parseAdminDetailPayload(payload, key, schema, id), /Phản hồi nội dung/);
    }
  }
});
