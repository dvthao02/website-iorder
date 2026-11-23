import assert from "node:assert/strict";
import test from "node:test";

import {
  consultFormSchema,
  consultPopupSchema,
  defaultConsultForm,
  defaultConsultPopup,
  defaultPromotionPopup,
  promotionPopupSchema,
  storedConsultPopupSchema,
} from "./consult-popup.contract";

const image = "2304f978-1dd5-43ec-9e30-91db934955ff";
const enabledPromo = { ...defaultPromotionPopup, enabled: true };

test("biểu mẫu và quảng cáo có schema, trạng thái và lịch hiển thị riêng", () => {
  assert.equal(consultFormSchema.parse(defaultConsultForm).enabled, true);
  assert.equal(promotionPopupSchema.parse(defaultPromotionPopup).enabled, false);
  const parsed = consultPopupSchema.parse({
    form: { ...defaultConsultForm, scope: "home", scrollPercent: 60 },
    promo: { ...defaultPromotionPopup, scope: "all", scrollPercent: 85 },
  });
  assert.equal(parsed.form.scope, "home");
  assert.equal(parsed.form.scrollPercent, 60);
  assert.equal(parsed.promo.scope, "all");
  assert.equal(parsed.promo.scrollPercent, 85);
});

test("dữ liệu gộp cũ được tách ra và sao chép lịch hiển thị cho từng phần", () => {
  const oldCombined = {
    form: { enabled: true, title: "Tư vấn", description: null, submitLabel: "Gửi", needOptions: [] },
    promo: { enabled: false, layout: "card", title: "Quảng cáo", description: null, mediaId: null, actionLabel: null, actionUrl: null },
    scrollPercent: 72,
    delaySeconds: 6,
    repeatDays: 9,
    scope: "home",
  };
  const parsed = storedConsultPopupSchema.parse(oldCombined);
  assert.equal(parsed.form.scrollPercent, 72);
  assert.equal(parsed.promo.scrollPercent, 72);
  assert.equal(parsed.form.scope, "home");
  assert.equal(parsed.promo.scope, "home");
});

test("dữ liệu đời đầu chỉ bật đúng loại đã chọn", () => {
  const legacy = {
    enabled: true,
    mode: "promo",
    title: "Ưu đãi thiết bị",
    description: null,
    submitLabel: "Gửi tư vấn",
    needOptions: [],
    mediaId: image,
    actionLabel: "Xem thiết bị",
    actionUrl: "/equipment",
    scrollPercent: 85,
    delaySeconds: 8,
    repeatDays: 3,
    scope: "all",
  };
  const parsed = storedConsultPopupSchema.parse(legacy);
  assert.equal(parsed.form.enabled, false);
  assert.equal(parsed.promo.enabled, true);
  assert.equal(parsed.promo.layout, "card");
  assert.equal(parsed.promo.title, "Ưu đãi thiết bị");
});

test("quảng cáo dạng thẻ bắt buộc có chữ và đường dẫn cho nút bấm", () => {
  const result = promotionPopupSchema.safeParse(enabledPromo);
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues.map((issue) => issue.path.join(".")).sort(), ["actionLabel", "actionUrl"]);
  assert.equal(promotionPopupSchema.safeParse({ ...enabledPromo, actionLabel: "Xem", actionUrl: "/contact" }).success, true);
});

test("quảng cáo chỉ ảnh cần ảnh và đường dẫn, không cần chữ trên nút", () => {
  const banner = { ...enabledPromo, layout: "image" as const };
  const result = promotionPopupSchema.safeParse(banner);
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues.map((issue) => issue.path.join(".")).sort(), ["actionUrl", "mediaId"]);
  assert.equal(promotionPopupSchema.safeParse({ ...banner, mediaId: image, actionUrl: "https://shopee.vn/shop/123" }).success, true);
});

test("các mẫu quảng cáo kiểm tra đúng nội dung bắt buộc", () => {
  for (const layout of ["card", "compact", "bar"] as const) {
    assert.equal(promotionPopupSchema.safeParse({ ...enabledPromo, layout, actionLabel: "Xem chi tiết", actionUrl: "/software" }).success, true, layout);
  }
  const split = { ...enabledPromo, layout: "split" as const, actionLabel: "Xem chi tiết", actionUrl: "/software" };
  assert.equal(promotionPopupSchema.safeParse(split).success, false);
  assert.equal(promotionPopupSchema.safeParse({ ...split, mediaId: image }).success, true);
});

test("đường dẫn nhận trang nội bộ, liên kết ngoài, tel và mailto", () => {
  for (const actionUrl of ["/contact", "https://zalo.me/iorder", "http://example.vn/a?b=1", "tel:0287107399", "tel:+84287", "mailto:contact@iorder.vn"]) {
    assert.equal(promotionPopupSchema.safeParse({ ...enabledPromo, actionLabel: "Xem", actionUrl }).success, true, actionUrl);
  }
});

test("đường dẫn từ chối mã script và địa chỉ không đầy đủ", () => {
  for (const actionUrl of ["javascript:alert(1)", "//evil.example", "iorder.vn", "/lien he", "data:text/html,x", "ftp://x.vn/a", "tel:abc", "mailto:khong-co-a-cong", "https://"]) {
    assert.equal(promotionPopupSchema.safeParse({ ...enabledPromo, actionLabel: "Xem", actionUrl }).success, false, actionUrl);
  }
});

test("mỗi cấu hình tự kiểm tra ngưỡng và không nhận khóa lạ", () => {
  assert.equal(consultFormSchema.safeParse({ ...defaultConsultForm, scrollPercent: 20 }).success, false);
  assert.equal(promotionPopupSchema.safeParse({ ...defaultPromotionPopup, delaySeconds: -1 }).success, false);
  assert.equal(consultFormSchema.safeParse({ ...defaultConsultForm, repeatDays: 366 }).success, false);
  assert.equal(consultPopupSchema.safeParse({ ...defaultConsultPopup, extra: true }).success, false);
});
