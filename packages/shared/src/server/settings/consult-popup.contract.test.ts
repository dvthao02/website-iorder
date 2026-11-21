import assert from "node:assert/strict";
import test from "node:test";

import { consultPopupSchema, defaultConsultPopup } from "./consult-popup.contract";

const image = "2304f978-1dd5-43ec-9e30-91db934955ff";
const enabledPromo = {
  ...defaultConsultPopup,
  promo: { ...defaultConsultPopup.promo, enabled: true },
};

test("cấu hình mặc định bật biểu mẫu và tắt quảng cáo", () => {
  const parsed = consultPopupSchema.parse(defaultConsultPopup);
  assert.equal(parsed.form.enabled, true);
  assert.equal(parsed.promo.enabled, false);
});

test("dữ liệu cũ được chuyển sang hai mục độc lập", () => {
  const legacy = {
    enabled: true,
    mode: "promo",
    title: "Ưu đãi thiết bị",
    description: null,
    submitLabel: "Gửi tư vấn",
    needOptions: [],
    mediaId: image,
    actionLabel: "Xem thiết bị",
    actionUrl: "/thiet-bi",
    scrollPercent: 85,
    delaySeconds: 8,
    repeatDays: 3,
    scope: "all",
  };
  const parsed = consultPopupSchema.parse(legacy);
  assert.equal(parsed.form.enabled, true);
  assert.equal(parsed.promo.enabled, true);
  assert.equal(parsed.promo.layout, "card");
  assert.equal(parsed.promo.title, "Ưu đãi thiết bị");
});

test("biểu mẫu và quảng cáo có thể bật đồng thời", () => {
  const result = consultPopupSchema.safeParse({
    ...enabledPromo,
    promo: { ...enabledPromo.promo, actionLabel: "Xem thiết bị", actionUrl: "/thiet-bi" },
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.form.enabled, true);
  assert.equal(result.data?.promo.enabled, true);
});

test("quảng cáo dạng thẻ bắt buộc có chữ và đường dẫn cho nút bấm", () => {
  const result = consultPopupSchema.safeParse(enabledPromo);
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues.map((issue) => issue.path.join(".")).sort(), ["promo.actionLabel", "promo.actionUrl"]);
  assert.equal(consultPopupSchema.safeParse({ ...enabledPromo, promo: { ...enabledPromo.promo, actionLabel: "Xem", actionUrl: "/lien-he" } }).success, true);
});

test("quảng cáo chỉ ảnh cần ảnh và đường dẫn, không cần chữ trên nút", () => {
  const banner = { ...enabledPromo, promo: { ...enabledPromo.promo, layout: "image" as const } };
  const result = consultPopupSchema.safeParse(banner);
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues.map((issue) => issue.path.join(".")).sort(), ["promo.actionUrl", "promo.mediaId"]);
  assert.equal(consultPopupSchema.safeParse({ ...banner, promo: { ...banner.promo, mediaId: image, actionUrl: "https://shopee.vn/shop/123" } }).success, true);
});

test("đường dẫn nhận trang nội bộ, liên kết ngoài, tel và mailto", () => {
  for (const actionUrl of ["/lien-he", "https://zalo.me/iorder", "http://example.vn/a?b=1", "tel:0287107399", "tel:+84287", "mailto:contact@iorder.vn"]) {
    const value = { ...enabledPromo, promo: { ...enabledPromo.promo, actionLabel: "Xem", actionUrl } };
    assert.equal(consultPopupSchema.safeParse(value).success, true, actionUrl);
  }
});

test("đường dẫn từ chối mã script và địa chỉ không đầy đủ", () => {
  for (const actionUrl of ["javascript:alert(1)", "//evil.example", "iorder.vn", "/lien he", "data:text/html,x", "ftp://x.vn/a", "tel:abc", "mailto:khong-co-a-cong", "https://"]) {
    const value = { ...enabledPromo, promo: { ...enabledPromo.promo, actionLabel: "Xem", actionUrl } };
    assert.equal(consultPopupSchema.safeParse(value).success, false, actionUrl);
  }
});

test("ngưỡng hiển thị nằm trong khoảng và không nhận khóa lạ", () => {
  assert.equal(consultPopupSchema.safeParse({ ...defaultConsultPopup, scrollPercent: 20 }).success, false);
  assert.equal(consultPopupSchema.safeParse({ ...defaultConsultPopup, delaySeconds: -1 }).success, false);
  assert.equal(consultPopupSchema.safeParse({ ...defaultConsultPopup, repeatDays: 366 }).success, false);
  assert.equal(consultPopupSchema.safeParse({ ...defaultConsultPopup, extra: true }).success, false);
});
