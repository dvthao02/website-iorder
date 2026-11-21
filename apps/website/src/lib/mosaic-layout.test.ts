import assert from "node:assert/strict";
import { test } from "node:test";

import { descriptionLines, mosaicMediaKind, mosaicRows } from "./mosaic-layout";

test("Số thẻ chia hai hàng, hàng trên ít thẻ hơn hoặc bằng hàng dưới", () => {
  assert.deepEqual(mosaicRows(0), []);
  assert.deepEqual(mosaicRows(1), [1]);
  assert.deepEqual(mosaicRows(2), [1, 1]);
  assert.deepEqual(mosaicRows(3), [1, 2]);
  assert.deepEqual(mosaicRows(5), [2, 3]);
  assert.deepEqual(mosaicRows(6), [3, 3]);
  assert.deepEqual(mosaicRows(7), [3, 4]);
});

test("Mô tả nhiều dòng thành nhiều ý, bỏ dòng trống và dấu gạch đầu dòng", () => {
  assert.deepEqual(descriptionLines("Bán hàng\n\n- Trạm sạc\r\n• Hóa đơn điện tử  "), ["Bán hàng", "Trạm sạc", "Hóa đơn điện tử"]);
  assert.deepEqual(descriptionLines("Một câu mô tả."), ["Một câu mô tả."]);
  assert.deepEqual(descriptionLines(null), []);
  assert.deepEqual(descriptionLines("-5 độ C"), ["-5 độ C"]);
});

test("PNG và WebP là ảnh sản phẩm nền trong suốt; định dạng khác là ảnh chụp", () => {
  assert.equal(mosaicMediaKind("image/png"), "cutout");
  assert.equal(mosaicMediaKind("image/webp"), "cutout");
  assert.equal(mosaicMediaKind("image/jpeg"), "photo");
  assert.equal(mosaicMediaKind(undefined), "photo");
});
