import assert from "node:assert/strict";
import test from "node:test";
import { pageBlockInputSchema } from "@iorder/shared/server/pages/pages.contract";
import { selectionFromItemId } from "./builder-item-model";

const features = pageBlockInputSchema.parse({ type: "features", isEnabled: true, data: { eyebrow: null, title: "Lợi ích", description: null, items: [{ title: "A", description: "", href: "" }, { title: "B", description: "", href: "" }] } });
const hero = pageBlockInputSchema.parse({ type: "hero", isEnabled: true, data: { eyebrow: null, title: "Đầu trang", description: null, primaryAction: null, secondaryAction: null } });
const slider = pageBlockInputSchema.parse({ type: "hero", isEnabled: true, data: { eyebrow: null, title: "Trượt", description: null, primaryAction: null, secondaryAction: null, layout: "slider" } });

test("Chọn mục con theo mã trên canvas: đúng nhóm và chỉ số, không đoán theo chữ", () => {
  assert.deepEqual(selectionFromItemId(features, "items:1"), { path: "items", index: 1, heading: "Các thẻ", tab: "content", parentIndex: undefined });
  assert.equal(selectionFromItemId(features, "items:9"), null, "chỉ số vượt quá số mục");
  assert.equal(selectionFromItemId(features, "plans:0"), null, "nhóm không thuộc khối này");
  assert.equal(selectionFromItemId(features, "items:x"), null);
  assert.equal(selectionFromItemId(features, undefined), null);
});

test("Phần đầu trang: mã hero.primary hoặc bấm một trường thì mở nội dung chính; bấm nền thì giữ thiết lập chung", () => {
  assert.equal(selectionFromItemId(hero, "hero.primary")?.path, "hero.primary");
  assert.equal(selectionFromItemId(hero, undefined, "image")?.path, "hero.primary");
  assert.equal(selectionFromItemId(hero, undefined, undefined), null);
  assert.equal(selectionFromItemId(slider, "hero.primary"), null, "kiểu trượt không có mục chính");
  assert.equal(selectionFromItemId(features, undefined, "title"), null, "khối khác: trường thuộc thiết lập chung");
});
