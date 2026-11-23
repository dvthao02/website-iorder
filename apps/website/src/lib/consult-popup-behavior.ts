import type { ConsultPopup } from "@iorder/shared/server/settings/consult-popup.contract";

type ScrollMetrics = {
  scrollY: number;
  innerHeight: number;
  scrollHeight: number;
};

export function consultPopupScrollProgress({ scrollY, innerHeight, scrollHeight }: ScrollMetrics) {
  const scrollableDistance = Math.max(scrollHeight - innerHeight, 0);
  if (scrollableDistance === 0) return 0;
  return Math.min(100, Math.max(0, (scrollY / scrollableDistance) * 100));
}

export type ConsultPopupKind = "promo" | "form";

// Cùng một chuỗi `sizes` cho ảnh vô hình chờ tải và ảnh thật trong hộp, để trình duyệt chọn đúng một bản ảnh và dùng lại bản đã tải.
export function consultPopupImageSizes(layout: ConsultPopup["promo"]["layout"]) {
  if (layout === "image") return "(min-width: 640px) 480px, 92vw";
  return layout === "split" ? "(min-width: 640px) 360px, 100vw" : "(min-width: 640px) 512px, 100vw";
}

const dayMilliseconds = 86_400_000;
// Khách đã gửi biểu mẫu thì không làm phiền lại trong chừng này ngày.
export const consultPopupSubmittedDays = 30;

// Đã đóng/gửi (còn hiệu lực) thì không hiện lại. `days` = 0: chỉ nhớ trong phiên (sessionStorage), lớn hơn 0: nhớ theo ngày (localStorage).
export function consultPopupSuppressed(storageKey: string) {
  try {
    if (sessionStorage.getItem(storageKey)) return true;
    return Number(localStorage.getItem(storageKey)) > Date.now();
  } catch { return false; }
}

export function consultPopupRemember(storageKey: string, days: number) {
  try {
    if (days <= 0) sessionStorage.setItem(storageKey, "1");
    else localStorage.setItem(storageKey, String(Date.now() + days * dayMilliseconds));
  } catch { /* Trình duyệt chặn lưu trữ: popup vẫn hoạt động nhưng không nhớ lần đóng. */ }
}

export function consultPopupStorageKey(popup: ConsultPopup, kind: ConsultPopupKind) {
  const identity = kind === "promo"
    ? [kind, popup.promo.layout, popup.promo.title, popup.promo.mediaId ?? "", popup.promo.actionLabel ?? "", popup.promo.actionUrl ?? ""]
    : [kind, popup.form.title, popup.form.submitLabel];
  const value = identity.join("\u001f");

  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `iorder-consult-popup:${(hash >>> 0).toString(36)}`;
}
