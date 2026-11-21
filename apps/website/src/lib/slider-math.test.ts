import assert from "node:assert/strict";
import { test } from "node:test";

import { nextSliderIndex, previousSliderIndex, sliderIndexFromScroll, sliderPages } from "./slider-math";

test("Số vị trí dừng = tổng ảnh − số ảnh hiện cùng lúc + 1, tối thiểu 1", () => {
  assert.equal(sliderPages(6, 3), 4);
  assert.equal(sliderPages(3, 3), 1);
  assert.equal(sliderPages(2, 3), 1);
  assert.equal(sliderPages(0, 3), 1);
  assert.equal(sliderPages(5, 0), 5);
});

test("Ảnh kế tiếp và trước đó quay vòng ở hai đầu", () => {
  assert.equal(nextSliderIndex(0, 4), 1);
  assert.equal(nextSliderIndex(3, 4), 0);
  assert.equal(previousSliderIndex(0, 4), 3);
  assert.equal(previousSliderIndex(2, 4), 1);
  assert.equal(nextSliderIndex(0, 1), 0);
});

test("Vị trí đang xem làm tròn theo thanh cuộn và không vượt số trang", () => {
  assert.equal(sliderIndexFromScroll(0, 400, 4), 0);
  assert.equal(sliderIndexFromScroll(610, 400, 4), 2);
  assert.equal(sliderIndexFromScroll(5000, 400, 4), 3);
  assert.equal(sliderIndexFromScroll(-20, 400, 4), 0);
  assert.equal(sliderIndexFromScroll(300, 0, 4), 0);
});
