import type { PromotionPopupSettings } from "./consult-popup.contract";

// Website và bản xem trước trong CMS cùng dùng các quy tắc này, nên bản xem trước không thể lệch với thứ khách thật sự thấy.

/** Bố cục quảng cáo quyết định cách phủ trang và có dùng ảnh hay không. `hasImage` = đã chọn ảnh và tải được ảnh. */
export function consultPopupPromoLayout(layout: PromotionPopupSettings["layout"], hasImage: boolean) {
  return {
    banner: layout === "image" && hasImage,
    bar: layout === "bar",
    modal: layout !== "bar",
    showImage: hasImage && (layout === "card" || layout === "split"),
  };
}

// Dữ liệu cũ từng lưu chữ "X" (ý định là nút đóng) làm chữ trên nút; hiển thị thành "Xem chi tiết" để nút còn nghĩa.
export const defaultPromotionActionLabel = "Xem chi tiết";

export function consultPopupPromoPresentation(promotion: Pick<PromotionPopupSettings, "actionLabel">) {
  const actionLabel = promotion.actionLabel?.trim();
  return { actionLabel: actionLabel && !/^[x×]$/i.test(actionLabel) ? actionLabel : defaultPromotionActionLabel };
}
