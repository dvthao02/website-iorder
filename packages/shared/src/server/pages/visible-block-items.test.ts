import assert from "node:assert/strict";
import test from "node:test";
import { pageBlockInputSchema } from "./pages.contract";
import { visibleBlockItems } from "./visible-block-items";

test("Ẩn item chỉ ảnh hưởng renderer, không xóa dữ liệu đang lưu", () => {
  const block = pageBlockInputSchema.parse({ type: "features", isEnabled: true, data: { eyebrow: null, title: "Lợi ích", description: null, items: [{ title: "Đang hiện", description: "A", href: null }, { title: "Đang ẩn", description: "B", href: null, isEnabled: false }] } });
  const rendered = visibleBlockItems(block);
  assert.equal(rendered.type === "features" && rendered.data.items.length, 1);
  assert.equal(block.type === "features" && block.data.items.length, 2);
  assert.ok(pageBlockInputSchema.safeParse(block).success);
});
test("Lọc cả nhóm và item con mà vẫn đọc nguyên dữ liệu cũ", () => {
  const block = pageBlockInputSchema.parse({ type: "grouped_list", isEnabled: true, data: { eyebrow: null, title: "Nhóm", description: null, groupLabel: null, groups: [{ title: "Nhóm hiện", icon: null, action: null, items: [{ label: "Giữ", icon: null, href: null }, { label: "Ẩn", icon: null, href: null, isEnabled: false }] }, { title: "Nhóm ẩn", icon: null, action: null, items: [], isEnabled: false }] } });
  const rendered = visibleBlockItems(block);
  assert.equal(rendered.type === "grouped_list" && rendered.data.groups.length, 1);
  assert.equal(rendered.type === "grouped_list" && rendered.data.groups[0].items.length, 1);
  assert.equal(block.type === "grouped_list" && block.data.groups.length, 2);
});
