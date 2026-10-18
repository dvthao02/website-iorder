import assert from "node:assert/strict";
import test from "node:test";
import { contentDeleteRequestSchema } from "./content-version";
import { deleteArchivedAdminPost } from "../posts/posts.service";
import { deleteArchivedAdminOffering } from "../offerings/offerings.service";

test("xóa nội dung yêu cầu version hợp lệ, không nhận snapshot hoặc action", async () => {
  assert.deepEqual(contentDeleteRequestSchema.parse({ expectedVersion: 0 }), { expectedVersion: 0 });
  for (const body of [{}, { expectedVersion: "3" }, { expectedVersion: -1 }, { expectedVersion: 1.5 }, { expectedVersion: Infinity }, { expectedVersion: 3, action: "archive" }, { expectedVersion: 3, content: {} }]) {
    assert.equal(contentDeleteRequestSchema.safeParse(body).success, false);
  }
  const id = "12345678-1234-4234-8234-123456789012";
  for (const remove of [deleteArchivedAdminPost, deleteArchivedAdminOffering]) {
    for (const version of [undefined, -1, 1.5, Infinity]) {
      await assert.rejects(remove(id, id, version as number), { name: "ZodError" });
    }
  }
});
import { assertContentVersion, contentStateAfterAction, contentStateRequestSchema, contentUpdateRequestSchema, ContentVersionConflictError } from "./content-version";
test("ma trận archive/restore chỉ chuyển trạng thái hợp lệ và không sửa baseline", () => {
  for (const status of ["draft", "review", "scheduled", "published", "archived"] as const) {
    const current = { status, draftVersion: 3 };
    if (status === "archived") {
      assert.equal(contentStateAfterAction(current, "restore", 3), "draft");
      assert.throws(() => contentStateAfterAction(current, "archive", 3), ContentVersionConflictError);
    } else {
      assert.equal(contentStateAfterAction(current, "archive", 3), "archived");
      assert.throws(() => contentStateAfterAction(current, "restore", 3), ContentVersionConflictError);
    }
    for (const action of ["archive", "restore"] as const) assert.throws(() => contentStateAfterAction(current, action, 2), ContentVersionConflictError);
    assert.deepEqual(current, { status, draftVersion: 3 });
  }
});
test("thao tác trạng thái chỉ nhận action và version, không nhận snapshot client", () => {
  for (const action of ["archive", "restore"]) assert.equal(contentStateRequestSchema.safeParse({ action, expectedVersion: 3 }).success, true);
  for (const body of [{ action: "archive" }, { action: "delete", expectedVersion: 3 }, { action: "archive", expectedVersion: 3, content: {} }, { action: "restore", expectedVersion: "3" }]) assert.equal(contentStateRequestSchema.safeParse(body).success, false);
});
test("Phiên bản nội dung đúng được phép; cũ/tương lai/sai kiểu số bị từ chối", () => {
  assert.doesNotThrow(() => assertContentVersion(3, 3));
  for (const expected of [2, 4, -1, 3.5, NaN, Infinity]) assert.throws(() => assertContentVersion(3, expected), ContentVersionConflictError);
});
test("Request cập nhật bắt buộc version và tách khỏi nội dung không sửa bản nhập", () => {
  const source = { expectedVersion: 3, title: "  Bản nhập tiếng Việt  " };
  const { expectedVersion, ...values } = contentUpdateRequestSchema.parse(source);
  assert.equal(expectedVersion, 3);
  assert.deepEqual(values, { title: source.title });
  assert.deepEqual(source, { expectedVersion: 3, title: "  Bản nhập tiếng Việt  " });
  for (const bad of [{}, { expectedVersion: null }, { expectedVersion: "3" }, { expectedVersion: -1 }, { expectedVersion: 3.5 }]) assert.equal(contentUpdateRequestSchema.safeParse(bad).success, false);
});

test("Ghi cấu hình/danh mục có version: bắt buộc expectedVersion khi sửa", async () => {
  const { versionedWriteRequestSchema } = await import("./content-version");
  const { redirectRequestSchema } = await import("../redirects/redirects.contract");
  const { taxonomyRequestSchema } = await import("../taxonomy/taxonomy.contract");
  const { equipmentWriteRequestSchema } = await import("../equipment/equipment.contract");
  const id = "12345678-1234-4123-8123-123456789012";
  assert.equal(versionedWriteRequestSchema.safeParse({ values: {}, expectedVersion: 0 }).success, true);
  assert.equal(versionedWriteRequestSchema.safeParse({ values: {} }).success, false);
  const redirect = { sourcePath: "/cu", destinationPath: "/moi", statusCode: 301, isEnabled: true };
  assert.equal(redirectRequestSchema.safeParse({ id: null, values: redirect }).success, true);
  assert.equal(redirectRequestSchema.safeParse({ id, values: redirect }).success, false);
  assert.equal(redirectRequestSchema.safeParse({ id, values: redirect, expectedVersion: 2 }).success, true);
  assert.equal(taxonomyRequestSchema.safeParse({ kind: "tags", id, values: {} }).success, false);
  assert.equal(taxonomyRequestSchema.safeParse({ kind: "tags", id, values: {}, expectedVersion: 0 }).success, true);
  assert.equal(equipmentWriteRequestSchema.safeParse({ kind: "groups", id, values: {} }).success, false);
  assert.equal(equipmentWriteRequestSchema.safeParse({ kind: "groups", id: null, values: {} }).success, true);
});
