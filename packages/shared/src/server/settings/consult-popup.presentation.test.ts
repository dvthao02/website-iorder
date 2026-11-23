import assert from "node:assert/strict";
import { test } from "node:test";

import { consultPopupPromoLayout, consultPopupPromoPresentation, defaultPromotionActionLabel } from "./consult-popup.presentation";

test("mỗi bố cục quảng cáo có cách phủ trang và dùng ảnh đúng mục đích", () => {
  assert.deepEqual(consultPopupPromoLayout("image", true), { banner: true, bar: false, modal: true, showImage: false });
  assert.deepEqual(consultPopupPromoLayout("card", true), { banner: false, bar: false, modal: true, showImage: true });
  assert.deepEqual(consultPopupPromoLayout("split", true), { banner: false, bar: false, modal: true, showImage: true });
  assert.deepEqual(consultPopupPromoLayout("compact", true), { banner: false, bar: false, modal: true, showImage: false });
  assert.deepEqual(consultPopupPromoLayout("bar", true), { banner: false, bar: true, modal: false, showImage: false });
});

test("bố cục dùng ảnh nhưng chưa có ảnh thì không còn là biểu ngữ hoặc hiện ảnh", () => {
  assert.deepEqual(consultPopupPromoLayout("image", false), { banner: false, bar: false, modal: true, showImage: false });
  assert.deepEqual(consultPopupPromoLayout("card", false), { banner: false, bar: false, modal: true, showImage: false });
  assert.deepEqual(consultPopupPromoLayout("split", false), { banner: false, bar: false, modal: true, showImage: false });
});

test("chữ trên nút quảng cáo: dùng chữ đã nhập, thay chữ X cũ và chữ trống bằng mặc định", () => {
  assert.equal(consultPopupPromoPresentation({ actionLabel: "Xem ưu đãi" }).actionLabel, "Xem ưu đãi");
  assert.equal(consultPopupPromoPresentation({ actionLabel: "  Nhận ngay  " }).actionLabel, "Nhận ngay");
  for (const stored of ["X", "x", "×", " X ", "", "   ", null]) {
    assert.equal(consultPopupPromoPresentation({ actionLabel: stored }).actionLabel, defaultPromotionActionLabel);
  }
});
