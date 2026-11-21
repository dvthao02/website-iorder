import assert from "node:assert/strict";
import { test } from "node:test";

import { equipmentPageLayoutSchema } from "../equipment/equipment.contract";
import { offeringSectionAppearanceSchema } from "../offerings/offering-content.contract";
import { sectionFrame } from "../pages/block-layout";
import { blockAppearanceSchema, detailHeroLayoutSchema } from "./appearance";

test("Phần đầu trang chi tiết: dữ liệu cũ (chỉ có 3 nền sẵn) vẫn đọc được và có mặc định", () => {
  assert.deepEqual(detailHeroLayoutSchema.parse({}), { layout: "split", height: "screen", background: "default", extraMediaIds: [] });
  assert.equal(detailHeroLayoutSchema.parse({ background: "tinted", layout: "centered" }).background, "tinted");
});

test("Phần đầu trang chi tiết: nhận nền tối và vỏ giao diện (màu tự chọn, ảnh nền, lớp phủ); mã màu sai bị từ chối", () => {
  const parsed = detailHeroLayoutSchema.parse({ background: "dark", appearance: { tone: "custom", backgroundColor: "#0D1B33", backgroundMediaId: "6b0f6a46-8c1a-4f0e-9a3a-1f6f3f0b2a11", backgroundOverlay: 70 } });
  assert.equal(parsed.appearance?.backgroundColor, "#0d1b33");
  assert.equal(parsed.appearance?.backgroundOverlay, 70);
  assert.equal(detailHeroLayoutSchema.safeParse({ appearance: { tone: "custom", backgroundColor: "xanh" } }).success, false);
  assert.equal(detailHeroLayoutSchema.safeParse({ background: "den" }).success, false);
});

test("Thiết bị và sản phẩm/dịch vụ: thêm giao diện cho 'Thiết bị khác'/'Liên quan' và dải tư vấn, vẫn chặn khóa lạ", () => {
  const equipment = equipmentPageLayoutSchema.parse({ related: { tone: "tinted" }, consult: { tone: "white" } });
  assert.equal(equipment.related?.tone, "tinted");
  assert.equal(equipment.consult?.tone, "white");
  assert.equal(offeringSectionAppearanceSchema.parse({ consult: { tone: "dark" } }).consult?.tone, "dark");
  assert.equal(equipmentPageLayoutSchema.safeParse({ footer: {} }).success, false);
  assert.deepEqual(offeringSectionAppearanceSchema.parse({}), {});
});

test("Phần đầu trang chi tiết: chiều cao có 4 mức (cả màn hình, 3/4, một nửa, theo nội dung), độ rộng 40–100%", () => {
  for (const height of ["screen", "three_quarter", "half", "auto", "custom"] as const) assert.equal(detailHeroLayoutSchema.parse({ height }).height, height);
  assert.equal(detailHeroLayoutSchema.safeParse({ height: "tall" }).success, false);
  assert.equal(detailHeroLayoutSchema.parse({ appearance: { width: 70 } }).appearance?.width, 70);
  assert.equal(detailHeroLayoutSchema.safeParse({ appearance: { width: 10 } }).success, false);
});

test("Phần cố định có thể ẩn khỏi website: khung mang cờ hidden, không ẩn thì không có", () => {
  const options = { fallback: "tinted", darkAllowed: true, spacing: "md" } as const;
  assert.equal(sectionFrame({ ...blockAppearanceSchema.parse({}), hidden: true }, options).hidden, true);
  assert.equal("hidden" in sectionFrame(blockAppearanceSchema.parse({}), options), false);
  assert.equal("hidden" in sectionFrame({ ...blockAppearanceSchema.parse({}), hidden: false }, options), false);
});

test("Khóa chỉnh sửa chỉ là cờ của CMS: lưu được trong giao diện phần, không đổi khung hiển thị trên website", () => {
  const locked = blockAppearanceSchema.parse({ locked: true });
  assert.equal(locked.locked, true);
  assert.deepEqual(sectionFrame(locked, { fallback: "tinted", darkAllowed: true, spacing: "md" }), sectionFrame(blockAppearanceSchema.parse({}), { fallback: "tinted", darkAllowed: true, spacing: "md" }));
  assert.equal(detailHeroLayoutSchema.parse({ appearance: { locked: true } }).appearance?.locked, true);
});

test("Phần đầu trang chi tiết: ảnh trượt thêm tối đa 7 ảnh, mỗi ảnh là mã media hợp lệ", () => {
  const id = "6b0f6a46-8c1a-4f0e-9a3a-1f6f3f0b2a11";
  assert.deepEqual(detailHeroLayoutSchema.parse({ extraMediaIds: [id] }).extraMediaIds, [id]);
  assert.equal(detailHeroLayoutSchema.safeParse({ extraMediaIds: Array.from({ length: 8 }, () => id) }).success, false);
  assert.equal(detailHeroLayoutSchema.safeParse({ extraMediaIds: [""] }).success, false);
});
