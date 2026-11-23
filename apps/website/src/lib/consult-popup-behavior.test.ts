import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultConsultPopup } from "@iorder/shared/server/settings/consult-popup.contract";
import { consultPopupRemember, consultPopupScrollProgress, consultPopupStorageKey, consultPopupSuppressed } from "./consult-popup-behavior";

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
  assert.notEqual(consultPopupStorageKey({ ...defaultConsultPopup, promo: { ...defaultConsultPopup.promo, actionUrl: "/software" } }, "promo"), promoKey);
  assert.notEqual(consultPopupStorageKey({ ...defaultConsultPopup, promo: { ...defaultConsultPopup.promo, layout: "split" } }, "promo"), promoKey);
  assert.notEqual(formKey, promoKey);
});

function fakeStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test("ghi nhớ theo phiên khi 0 ngày, theo ngày khi lớn hơn 0 và hết hạn đúng lúc", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const [session, local] = [fakeStorage(), fakeStorage()];
  globals.sessionStorage = session; globals.localStorage = local;
  try {
    assert.equal(consultPopupSuppressed("a"), false);
    consultPopupRemember("a", 0);
    assert.equal(consultPopupSuppressed("a"), true);
    assert.equal(local.getItem("a"), null);

    consultPopupRemember("b", 3);
    assert.equal(consultPopupSuppressed("b"), true);
    local.setItem("b", String(Date.now() - 1));
    assert.equal(consultPopupSuppressed("b"), false);
  } finally {
    delete globals.sessionStorage; delete globals.localStorage;
  }
});

test("trình duyệt chặn lưu trữ thì không báo lỗi và coi như chưa đóng", () => {
  assert.doesNotThrow(() => consultPopupRemember("c", 7));
  assert.equal(consultPopupSuppressed("c"), false);
});
