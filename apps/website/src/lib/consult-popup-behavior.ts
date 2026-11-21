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

export function consultPopupPromoPresentation(popup: ConsultPopup) {
  const actionLabel = popup.promo.actionLabel?.trim();
  const inheritedCopy = popup.promo.title.trim() === popup.form.title.trim()
    && (popup.promo.description?.trim() ?? "") === (popup.form.description?.trim() ?? "");
  return {
    actionLabel: actionLabel && !/^[x×]$/i.test(actionLabel) ? actionLabel : "Xem chi tiết",
    showCopy: !inheritedCopy,
  };
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
