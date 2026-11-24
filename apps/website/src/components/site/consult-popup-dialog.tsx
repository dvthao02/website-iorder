"use client";

import { ArrowRight, ChevronDown, CircleCheck, ExternalLink, Phone, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { isPopupExternalLink, type ConsultPopup as ConsultPopupSettings } from "@iorder/shared/server/settings/consult-popup.contract";
import { consultPopupPromoLayout, consultPopupPromoPresentation } from "@iorder/shared/server/settings/consult-popup.presentation";
import { consultPopupImageSizes, consultPopupRemember, consultPopupSubmittedDays, type ConsultPopupKind } from "@/lib/consult-popup-behavior";
import { submitLead, warmLeadToken } from "@/lib/submit-lead";
import { Field, inputClassName } from "./lead-form";
import { PhoneInput } from "./phone-input";
import { SiteLink } from "./site-link";

const focusable = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled])';

export type PopupImage = { url: string; alt: string; width: number | null; height: number | null };
export type ConsultPopupDialogProps = {
  popup: ConsultPopupSettings;
  image: PopupImage | null;
  hotline: string | null;
  pathname: string;
  kind: ConsultPopupKind;
  storageKey: string;
  close: (days: number) => void;
  /** Bỏ hộp lần này mà không ghi nhớ là khách đã đóng (ví dụ ảnh quảng cáo không tải được), để lần sau còn cơ hội hiện lại. */
  abandon: () => void;
};

function PromoLink({ href, className, label, onClick, children }: { href: string; className: string; label?: string; onClick: () => void; children: ReactNode }) {
  if (isPopupExternalLink(href)) return <a aria-label={label} className={className} href={href} onClick={onClick} rel="noopener noreferrer" target="_blank">{children}</a>;
  if (!href.startsWith("/")) return <a aria-label={label} className={className} href={href} onClick={onClick}>{children}</a>;
  return <SiteLink aria-label={label} className={className} href={href} onClick={onClick}>{children}</SiteLink>;
}

// Chờ tối đa chừng này mili giây để ảnh tải xong trước khi hiện quảng cáo; quá hạn thì coi như ảnh hỏng.
const imageWaitMs = 4_000;

// Quảng cáo có ảnh chỉ hiện khi ảnh đã tải xong: không để khách thấy khung trắng chỉ có nút đóng rồi nội dung nhảy vào.
// Trong lúc chờ chỉ có một ảnh vô hình cùng `sizes` với ảnh thật nên trình duyệt tải đúng bản sẽ dùng.
// Ảnh hỏng: bố cục lấy ảnh làm nội dung (chỉ ảnh, chia đôi) thì bỏ lần này; thẻ tiêu chuẩn vẫn hiện, chỉ không có ảnh.
export function ConsultPopupDialog(props: ConsultPopupDialogProps) {
  const { abandon, image, kind, popup } = props;
  const layout = consultPopupPromoLayout(popup.promo.layout, image !== null);
  const awaited = kind === "promo" && image !== null && (layout.banner || layout.showImage) ? image : null;
  const awaitedUrl = awaited?.url ?? null;
  const imageRequired = popup.promo.layout === "image" || popup.promo.layout === "split";
  const [imageState, setImageState] = useState<"loading" | "ready" | "failed">(awaitedUrl ? "loading" : "ready");
  const skip = imageState === "failed" && imageRequired;

  useEffect(() => {
    if (!awaitedUrl) return;
    const timer = window.setTimeout(() => setImageState((current) => current === "loading" ? "failed" : current), imageWaitMs);
    return () => window.clearTimeout(timer);
  }, [awaitedUrl]);
  useEffect(() => { if (skip) abandon(); }, [abandon, skip]);

  if (awaited && imageState === "loading") {
    return <Image alt="" aria-hidden="true" className="consult-popup__preload" height={awaited.height ?? 1} loading="eager" onError={() => setImageState("failed")} onLoad={() => setImageState("ready")} sizes={consultPopupImageSizes(popup.promo.layout)} src={awaited.url} width={awaited.width ?? 1} />;
  }
  if (skip) return null;
  return <PopupContent {...props} image={imageState === "failed" ? null : image} />;
}

// Hộp thoại chỉ được tải khi popup sắp hiện (xem consult-popup.tsx), nên mã này, biểu mẫu và ảnh không nằm trong JS ban đầu của mọi trang.
function PopupContent({ popup, image, hotline, pathname, close, kind, storageKey }: ConsultPopupDialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  // Biểu mẫu tư vấn hiện ra thì xin mã phiên gửi trước (xem leads.guard.ts).
  useEffect(() => { if (kind === "form") warmLeadToken(); }, [kind]);
  const promo = kind === "promo";
  const repeatDays = promo ? popup.promo.repeatDays : popup.form.repeatDays;
  const dismiss = useCallback(() => close(repeatDays), [close, repeatDays]);
  const title = promo ? popup.promo.title : popup.form.title;
  const description = promo ? popup.promo.description : popup.form.description;
  const layout = consultPopupPromoLayout(popup.promo.layout, image !== null);
  const banner = promo && layout.banner;
  const bar = promo && layout.bar;
  const modal = !bar;
  const showPromoImage = promo && layout.showImage;
  const promoActionLabel = consultPopupPromoPresentation(popup.promo).actionLabel;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    if (modal) {
      document.body.style.overflow = "hidden";
      // Điện thoại: đưa con trỏ vào ô nhập sẽ bật bàn phím ngay, che gần hết hộp thoại khách chưa kịp đọc. Chỉ tự focus ô đầu khi có chuột.
      const autofocusField = !promo && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (autofocusField) panel.current?.querySelector<HTMLElement>("input, select")?.focus({ preventScroll: true });
      else panel.current?.focus({ preventScroll: true });
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss(); return; }
      if (!modal || event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(focusable)];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (modal) {
        document.body.style.overflow = overflow;
        previous?.focus({ preventScroll: true });
      }
    };
  }, [dismiss, modal, promo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await submitLead({ name: String(data.name ?? ""), phone: String(data.phone ?? ""), email: "", need: String(data.need ?? ""), message: `Gửi từ biểu mẫu tư vấn tự hiện · ${pathname}`, website: String(data.website ?? "") });
    setBusy(false);
    if (result.ok) { setSuccess(true); consultPopupRemember(storageKey, consultPopupSubmittedDays); }
    else setMessage(result.message);
  }

  const href = popup.promo.actionUrl ?? "/";
  const external = isPopupExternalLink(href);
  const panelClass = banner
    ? "consult-popup__panel consult-popup__panel--banner"
    : promo
      ? `consult-popup__panel consult-popup__panel--promo consult-popup__panel--${popup.promo.layout}`
      : "consult-popup__panel";
  const bodyClass = promo
    ? `consult-popup__body consult-popup__body--promo${bar ? " consult-popup__body--bar" : ""}${popup.promo.layout === "compact" ? " consult-popup__body--compact-promo" : ""}`
    : "consult-popup__body";
  return <div className={bar ? "consult-popup consult-popup--bar" : "consult-popup"} onMouseDown={(event) => { if (!bar && event.target === event.currentTarget) dismiss(); }} role="presentation">
    <div aria-describedby={!banner && description ? descriptionId : undefined} aria-label={banner ? title : undefined} aria-labelledby={banner ? undefined : titleId} aria-modal={modal ? true : undefined} className={panelClass} data-layout={promo ? popup.promo.layout : "form"} data-testid="consult-popup-dialog" ref={panel} role="dialog" tabIndex={-1}>
      <button aria-label="Đóng cửa sổ" className={banner ? "consult-popup__close consult-popup__close--float" : "consult-popup__close"} onClick={dismiss} type="button"><X aria-hidden="true" size={20} /></button>
      {banner && image
        ? <PromoLink className="consult-popup__banner group" href={href} label={`${title}${external ? " (mở trang ngoài)" : ""}`} onClick={() => close(repeatDays)}>
          {image.width && image.height
            ? <Image alt="" className="consult-popup__banner-image" height={image.height} sizes={consultPopupImageSizes("image")} src={image.url} width={image.width} />
            : <span className="consult-popup__banner-fallback"><Image alt="" className="object-cover" fill sizes={consultPopupImageSizes("image")} src={image.url} /></span>}
        </PromoLink>
        : <>
          {showPromoImage && image ? <div className="consult-popup__media"><Image alt={image.alt} className="consult-popup__media-image" fill sizes={consultPopupImageSizes(popup.promo.layout)} src={image.url} /></div> : null}
          <div className={bodyClass}>
            {success ? <div aria-live="polite" className="grid justify-items-center gap-3 py-6 text-center" role="status">
              <CircleCheck aria-hidden="true" className="text-accent-green" size={44} />
              <p className="mb-0 text-h3 font-bold text-ink">Đã nhận thông tin của bạn</p>
              <p className="mb-0 text-body text-muted">iOrder sẽ gọi lại trong giờ làm việc.</p>
              <button className="button button--secondary mt-2" onClick={() => close(consultPopupSubmittedDays)} type="button">Đóng</button>
            </div> : <>
              {promo ? null : <p className="consult-popup__eyebrow">Tư vấn iOrder</p>}
              <div className={promo ? "consult-popup__promo-copy" : "consult-popup__copy"}>
                <h2 className="mb-0 text-h3 font-bold tracking-tight text-balance text-ink" id={titleId}>{title}</h2>
                {description ? <p className="mb-0 text-body text-muted" id={descriptionId}>{description}</p> : null}
              </div>
              {promo
                ? <div className="consult-popup__actions">
                  <PromoLink className="button button--primary" href={href} onClick={() => close(repeatDays)}>{promoActionLabel}{external ? <ExternalLink aria-hidden="true" size={18} /> : <ArrowRight aria-hidden="true" size={18} />}</PromoLink>
                  {bar ? null : <button className="button button--secondary" onClick={dismiss} type="button">Để sau</button>}
                </div>
                : <form aria-label="Đăng ký nhận tư vấn" className="grid gap-4" onSubmit={submit}>
                  <Field label="Họ và tên" required><input autoComplete="name" className={inputClassName} enterKeyHint="next" maxLength={180} minLength={2} name="name" placeholder="Nguyễn Văn A" required /></Field>
                  <Field label="Số điện thoại" required><PhoneInput className={inputClassName} enterKeyHint={popup.form.needOptions.length ? "next" : "send"} /></Field>
                  {popup.form.needOptions.length ? <Field label="Nhu cầu chính" optional><div className="relative"><select className={`${inputClassName} appearance-none pr-10`} name="need"><option value="">Chọn nhu cầu</option>{popup.form.needOptions.map(option => <option key={option}>{option}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted" size={18} /></div></Field> : null}
                  <label aria-hidden="true" className="hidden">Website<input autoComplete="off" name="website" tabIndex={-1} /></label>
                  <button className="button button--primary w-full disabled:opacity-60" disabled={busy} type="submit">{busy ? "Đang gửi…" : popup.form.submitLabel}</button>
                  <p className="mb-0 flex items-center gap-1.5 text-caption text-faint"><ShieldCheck aria-hidden="true" size={14} />Thông tin của bạn chỉ dùng để liên hệ tư vấn.</p>
                  {message ? <p className="mb-0 text-small font-medium text-accent-rose" role="alert">{message}</p> : null}
                </form>}
              {!promo && hotline ? <p className="mb-0 flex flex-wrap items-center gap-x-2 border-t border-line pt-4 text-small text-muted"><Phone aria-hidden="true" size={16} />Muốn trao đổi trực tiếp? Gọi <a className="font-bold text-ink hover:text-brand-700 hover:underline" href={`tel:${hotline.replace(/[^\d+]/g, "")}`}>{hotline}</a></p> : null}
            </>}
          </div>
        </>}
    </div>
  </div>;
}
