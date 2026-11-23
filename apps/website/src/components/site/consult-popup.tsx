"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { ConsultPopup as ConsultPopupSettings } from "@iorder/shared/server/settings/consult-popup.contract";
import { consultPopupRemember, consultPopupScrollProgress, consultPopupStorageKey, consultPopupSuppressed, type ConsultPopupKind } from "@/lib/consult-popup-behavior";
import type { PopupImage } from "./consult-popup-dialog";

// Hộp thoại (biểu mẫu, ảnh, biểu tượng, bẫy focus) chỉ tải khi popup thật sự sắp hiện, sau khi khách lướt và chờ đủ lâu.
// Vỏ này nằm ở khung chung của mọi trang nên chỉ giữ phần quyết định "có hiện không / khi nào".
const Dialog = dynamic(() => import("./consult-popup-dialog").then((module) => module.ConsultPopupDialog), { ssr: false });

type Props = { popup: ConsultPopupSettings; image: PopupImage | null; hotline: string | null };
type OpenedPopup = { pathname: string; kind: ConsultPopupKind; storageKey: string };

// Hai nội dung có phạm vi và thời điểm riêng. Nếu cùng đủ điều kiện chính xác một lúc,
// quảng cáo thắng lần đó để không mở chồng hai hộp trên cùng một trang.
export function ConsultPopup({ popup, image, hotline }: Props) {
  const pathname = usePathname();
  const [opened, setOpened] = useState<OpenedPopup | null>(null);
  const open = opened?.pathname === pathname;
  const contactPage = pathname === "/contact" || pathname.startsWith("/contact/");
  const promoEligible = !contactPage && (popup.promo.scope === "all" || pathname === "/") && popup.promo.enabled && Boolean(popup.promo.actionUrl);
  const formEligible = !contactPage && (popup.form.scope === "all" || pathname === "/") && popup.form.enabled;
  const eligible = promoEligible || formEligible;
  const promoKey = consultPopupStorageKey(popup, "promo");
  const formKey = consultPopupStorageKey(popup, "form");

  useEffect(() => {
    if (!eligible) return;
    // Đọc bộ nhớ trình duyệt một lần ở đây, không đọc lại ở mỗi lần cuộn.
    const candidates: Array<OpenedPopup & { delaySeconds: number; scrollPercent: number }> = [];
    if (promoEligible) candidates.push({ pathname, kind: "promo", storageKey: promoKey, delaySeconds: popup.promo.delaySeconds, scrollPercent: popup.promo.scrollPercent });
    if (formEligible) candidates.push({ pathname, kind: "form", storageKey: formKey, delaySeconds: popup.form.delaySeconds, scrollPercent: popup.form.scrollPercent });
    const available = candidates.filter((item) => !consultPopupSuppressed(item.storageKey));
    if (!available.length) return;

    const startedAt = Date.now();
    let scrolled = window.scrollY > 0;
    let done = false;
    let timer: number | undefined;
    let frame: number | undefined;
    const check = () => {
      frame = undefined;
      if (done || !scrolled || document.hidden) return;
      const page = document.documentElement;
      const progress = consultPopupScrollProgress({ scrollY: window.scrollY, innerHeight: window.innerHeight, scrollHeight: page.scrollHeight });
      const candidate = available.find((item) => progress >= item.scrollPercent && Date.now() >= startedAt + item.delaySeconds * 1000);
      if (!candidate) {
        const waits = available.filter((item) => progress >= item.scrollPercent).map((item) => startedAt + item.delaySeconds * 1000 - Date.now()).filter((wait) => wait > 0);
        if (waits.length) { window.clearTimeout(timer); timer = window.setTimeout(check, Math.min(...waits) + 30); }
        return;
      }
      done = true;
      setOpened(candidate);
    };
    // Sự kiện cuộn bắn rất dày: gộp lại thành tối đa một lần kiểm tra mỗi khung hình.
    const schedule = () => { if (frame === undefined) frame = window.requestAnimationFrame(check); };
    const onScroll = () => { scrolled = true; schedule(); };
    // Khách chuyển tab lúc đến hạn thì lần kiểm tra bị bỏ qua; quay lại tab phải được kiểm tra lại, không đợi cuộn thêm.
    const onVisible = () => { if (!document.hidden) schedule(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    check();
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [eligible, formEligible, formKey, pathname, popup.form.delaySeconds, popup.form.scrollPercent, popup.promo.delaySeconds, popup.promo.scrollPercent, promoEligible, promoKey]);

  const close = useCallback((days: number) => {
    if (opened) consultPopupRemember(opened.storageKey, days);
    setOpened(null);
  }, [opened]);
  const abandon = useCallback(() => setOpened(null), []);
  if (!open || !opened || !eligible) return null;
  return <Dialog abandon={abandon} close={close} hotline={hotline} image={image} kind={opened.kind} pathname={pathname} popup={popup} storageKey={opened.storageKey} />;
}
