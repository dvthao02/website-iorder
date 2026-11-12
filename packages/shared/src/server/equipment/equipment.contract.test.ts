import assert from "node:assert/strict";
import test from "node:test";
import { equipmentInputSchema, equipmentWriteRequestSchema, type EquipmentInput } from "./equipment.contract";
import { assertEquipmentVersion, EquipmentVersionConflictError } from "./equipment-version";
import { equipmentPublishedAt } from "./equipment-publication";

const valid: EquipmentInput = {
  groupId: "11111111-1111-4111-8111-111111111111", name: "Máy POS", slug: "may-pos", modelCode: null,
  coverMediaId: null, priceVnd: 0, warrantyMonths: 12, summary: null, specificationGroups: [],
  status: "draft", scheduledAt: null, sortOrder: 0, isFeatured: false, seoTitle: null, seoDescription: null, canonicalUrl: null,
};
const now = new Date("2026-10-08T00:00:00Z");
const future = new Date("2026-10-09T00:00:00Z");

test("Cập nhật thiết bị và nhóm thiết bị bắt buộc expectedVersion, tạo mới thì không", () => {
  const request = { kind: "items", id: valid.groupId, values: valid };
  assert.equal(equipmentWriteRequestSchema.safeParse(request).success, false);
  assert.equal(equipmentWriteRequestSchema.safeParse({ ...request, expectedVersion: 2 }).success, true);
  assert.equal(equipmentWriteRequestSchema.safeParse({ ...request, expectedVersion: 0 }).success, true);
  for (const expectedVersion of [-1, 1.5, "2", Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(equipmentWriteRequestSchema.safeParse({ ...request, expectedVersion }).success, false);
  }
  assert.equal(equipmentWriteRequestSchema.safeParse({ ...request, id: null }).success, true);
  assert.equal(equipmentWriteRequestSchema.safeParse({ ...request, kind: "groups" }).success, false);
  assert.equal(equipmentWriteRequestSchema.safeParse({ ...request, kind: "groups", expectedVersion: 0 }).success, true);
});
test("Phiên bản cũ hoặc thiếu bị từ chối; bản mới được phép", () => {
  assert.doesNotThrow(() => assertEquipmentVersion(3, 3));
  assert.doesNotThrow(() => assertEquipmentVersion(0, 0));
  assert.throws(() => assertEquipmentVersion(3, 2), EquipmentVersionConflictError);
  assert.throws(() => assertEquipmentVersion(3, undefined), EquipmentVersionConflictError);
  assert.throws(() => assertEquipmentVersion(3, 4), EquipmentVersionConflictError);
});

test("Nháp tối thiểu hợp lệ và giữ dấu cách mô tả", () => {
  const result = equipmentInputSchema.parse({ ...valid, summary: "  Nội dung tiếng Việt  " });
  assert.equal(result.summary, "  Nội dung tiếng Việt  ");
});
test("Hẹn giờ bắt buộc ngày hợp lệ", () => {
  assert.equal(equipmentInputSchema.safeParse({ ...valid, status: "scheduled" }).success, false);
  assert.equal(equipmentInputSchema.safeParse({ ...valid, status: "scheduled", scheduledAt: "không phải ngày" }).success, false);
  assert.equal(equipmentInputSchema.safeParse({ ...valid, status: "scheduled", scheduledAt: future }).success, true);
});
test("Không nhận giá âm, số lẻ, quá giới hạn hoặc nhóm sai định dạng", () => {
  for (const changes of [{ priceVnd: -1 }, { priceVnd: 1.5 }, { priceVnd: Number.MAX_SAFE_INTEGER + 1 }, { warrantyMonths: 1201 }, { groupId: "invalid" }]) {
    assert.equal(equipmentInputSchema.safeParse({ ...valid, ...changes }).success, false);
  }
});
test("Không nhận slug sai và trường lạ", () => {
  for (const changes of [{ slug: "Sai slug" }, { slug: "" }, { unexpected: true }]) {
    assert.equal(equipmentInputSchema.safeParse({ ...valid, ...changes }).success, false);
  }
});
test("Thông số không được chỉ chứa khoảng trắng, chuẩn hóa khi submit", () => {
  for (const changes of [{ title: " " }, { items: [{ label: " ", value: "ok" }] }, { items: [{ label: "ok", value: " " }] }]) {
    assert.equal(equipmentInputSchema.safeParse({ ...valid, specificationGroups: [{ title: "Nhóm", items: [], ...changes }] }).success, false);
  }
  const result = equipmentInputSchema.parse({ ...valid, specificationGroups: [{ title: " Nhóm ", items: [{ label: " Cổng ", value: " USB " }] }] });
  assert.deepEqual(result.specificationGroups, [{ title: "Nhóm", items: [{ label: "Cổng", value: "USB" }] }]);
});
test("Xuất bản ngay từ hẹn giờ không giữ mốc tương lai", () => {
  assert.equal(equipmentPublishedAt({ status: "published", scheduledAt: future }, { status: "scheduled", publishedAt: future }, now), now);
});
test("Sửa nội dung đã xuất bản giữ ngày gốc hợp lệ", () => {
  const original = new Date("2026-10-01T00:00:00Z");
  assert.equal(equipmentPublishedAt({ status: "published", scheduledAt: null }, { status: "published", publishedAt: original }, now), original);
  assert.equal(equipmentPublishedAt({ status: "published", scheduledAt: null }, { status: "published", publishedAt: future }, now), now);
});
test("Hẹn giờ dùng lịch, nháp và lưu trữ bỏ ngày xuất bản", () => {
  assert.equal(equipmentPublishedAt({ status: "scheduled", scheduledAt: future }, undefined, now), future);
  for (const status of ["draft", "review", "archived"] as const) {
    assert.equal(equipmentPublishedAt({ status, scheduledAt: future }, { status: "published", publishedAt: now }, now), null);
  }
});
