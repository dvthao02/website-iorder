import assert from "node:assert/strict";
import test from "node:test";
import { pageBlockInputSchema } from "@iorder/shared/server/pages/pages.contract";
import { builderItemCollections, replaceBuilderItems } from "./builder-item-model";

test("Sửa danh sách item tạo bản mới và giữ nguyên trường khác của thành phần", () => {
  const block = pageBlockInputSchema.parse({ type: "features", isEnabled: true, data: { eyebrow: "Giới thiệu", title: "Lợi ích", description: "Mô tả", items: [{ title: "Một", description: "A", href: "/lien-he" }] } });
  const collection = builderItemCollections(block)[0];
  const updated = replaceBuilderItems(block, collection.path, [...collection.items, collection.create()]);
  assert.equal(block.type === "features" && block.data.items.length, 1);
  assert.equal(updated.type === "features" && updated.data.items.length, 2);
  assert.equal(updated.type === "features" && updated.data.eyebrow, "Giới thiệu");
  assert.ok(pageBlockInputSchema.safeParse(updated).success);
  assert.throws(() => replaceBuilderItems(block, "__proto__.items", []));
});

test("Tính năng gói giá lồng đúng gói, lưu lại đúng mảng chữ và không sửa gói khác", () => {
  const plan = { name: "Cơ bản", price: "Liên hệ", period: null, description: null, features: ["Một"], action: null, highlighted: false, badge: null };
  const block = pageBlockInputSchema.parse({ type: "pricing", isEnabled: true, data: { eyebrow: null, title: "Giá", description: null, note: null, plans: [plan, { ...plan, name: "Nâng cao", features: ["Hai"] }] } });
  const children = builderItemCollections(block).find(collection => collection.path === "plans.1.features")!;
  assert.equal(children.kind, "text");
  const updated = replaceBuilderItems(block, children.path, [...children.items, { label: "Ba" }]);
  assert.ok(updated.type === "pricing");
  assert.deepEqual(updated.data.plans[0].features, ["Một"]);
  assert.deepEqual(updated.data.plans[1].features, ["Hai", "Ba"]);
  assert.ok(pageBlockInputSchema.safeParse(updated).success);
  assert.ok(block.type === "pricing");
  assert.deepEqual(block.data.plans[1].features, ["Hai"]);
});

test("Điểm của khối ảnh chữ và nhu cầu tư vấn giữ định dạng dữ liệu cũ", () => {
  for (const input of [
    { type: "media_text", isEnabled: true, data: { title: "Ảnh và chữ", eyebrow: null, description: null, bullets: ["Nhanh"], mediaId: null, primaryAction: null, secondaryAction: null } },
    { type: "lead_form", isEnabled: true, data: { title: "Tư vấn", description: null, submitLabel: "Gửi", needOptions: ["Phần mềm"] } },
  ]) {
    const block = pageBlockInputSchema.parse(input);
    const collection = builderItemCollections(block)[0];
    const updated = replaceBuilderItems(block, collection.path, [{ label: "Đổi" }, collection.create()]);
    assert.ok(pageBlockInputSchema.safeParse(updated).success);
    assert.deepEqual(Reflect.get(updated.data, collection.path), ["Đổi", collection.create().label]);
    assert.deepEqual(Reflect.get(block.data, collection.path), input.type === "media_text" ? ["Nhanh"] : ["Phần mềm"]);
  }
});
