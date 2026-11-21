import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultConsultPopup } from "@iorder/shared/server/settings/consult-popup.contract";
import { consultPopupPromoPresentation, consultPopupScrollProgress, consultPopupStorageKey } from "./consult-popup-behavior";

test("tiến độ cuộn tính trên phần trang thực sự có thể cuộn", () => {
  assert.equal(consultPopupScrollProgress({ scrollY: 0, innerHeight: 800, scrollHeight: 2_800 }), 0);
  assert.equal(consultPopupScrollProgress({ scrollY: 1_000, innerHeight: 800, scrollHeight: 2_800 }), 50);
  assert.equal(consultPopupScrollProgress({ scrollY: 2_000, innerHeight: 800, scrollHeight: 2_800 }), 100);
});

test("tiến độ cuộn được giới hạn và trang không cuộn không tự đạt ngưỡng", () => {
  assert.equal(consultPopupScrollProgress({ scrollY: -20, innerHeight: 800, scrollHeight: 2_800 }), 0);
  assert.equal(consultPopupScrollProgress({ scrollY: 3_000, innerHeight: 800, scrollHeight: 2_800 }), 100);
  assert.equal(consultPopupScrollProgress({ scrollY: 0, innerHeight: 800, scrollHeight: 700 }), 0);
});

test("khóa ghi nhớ ổn định cho cùng nội dung và đổi khi chiến dịch đổi", () => {
  const formKey = consultPopupStorageKey(defaultConsultPopup, "form");
  const promoKey = consultPopupStorageKey(defaultConsultPopup, "promo");
  assert.equal(consultPopupStorageKey({ ...defaultConsultPopup }, "form"), formKey);
  assert.notEqual(consultPopupStorageKey({ ...defaultConsultPopup, form: { ...defaultConsultPopup.form, title: "Nội dung mới" } }, "form"), formKey);
  assert.notEqual(consultPopupStorageKey({ ...defaultConsultPopup, promo: { ...defaultConsultPopup.promo, actionUrl: "/phan-mem" } }, "promo"), promoKey);
  assert.notEqual(formKey, promoKey);
});

test("quảng cáo không lặp nội dung kế thừa từ biểu mẫu và thay CTA chỉ có chữ X", () => {
  const inherited = {
    ...defaultConsultPopup,
    promo: {
      ...defaultConsultPopup.promo,
      title: defaultConsultPopup.form.title,
      description: defaultConsultPopup.form.description,
      actionLabel: "X",
    },
  };
  assert.deepEqual(consultPopupPromoPresentation(inherited), { actionLabel: "Xem chi tiết", showCopy: false });
  assert.deepEqual(consultPopupPromoPresentation({ ...inherited, promo: { ...inherited.promo, title: "Ưu đãi thiết bị", actionLabel: "Xem ưu đãi" } }), { actionLabel: "Xem ưu đãi", showCopy: true });
});
