"use client";

import { ArrowRight, ChevronDown, CircleCheck, ExternalLink, Phone, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { isPopupExternalLink, type ConsultPopup as ConsultPopupSettings } from "@iorder/shared/server/settings/consult-popup.contract";
import { consultPopupPromoPresentation, consultPopupScrollProgress, consultPopupStorageKey, type ConsultPopupKind } from "@/lib/consult-popup-behavior";
import { submitLead } from "@/lib/submit-lead";
import { Field, inputClassName } from "./lead-form";
import { SiteLink } from "./site-link";

const dayMilliseconds = 86_400_000;
const submittedDays = 30;
const focusable = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled])';

function suppressed(storageKey: string) {
  try {
    if (sessionStorage.getItem(storageKey)) return true;
    return Number(localStorage.getItem(storageKey)) > Date.now();
  } catch { return false; }
}

function remember(storageKey: string, days: number) {
  try {
    if (days <= 0) sessionStorage.setItem(storageKey, "1");
    else localStorage.setItem(storageKey, String(Date.now() + days * dayMilliseconds));
  } catch { /* Trình duyệt chặn lưu trữ: popup vẫn hoạt động nhưng không nhớ lần đóng. */ }
}

type PopupImage = { url: string; alt: string; width: number | null; height: number | null };
type Props = { popup: ConsultPopupSettings; image: PopupImage | null; hotline: string | null };
type OpenedPopup = { pathname: string; kind: ConsultPopupKind; storageKey: string };

function PromoLink({ href, className, label, onClick, children }: { href: string; className: string; label?: string; onClick: () => void; children: ReactNode }) {
  if (isPopupExternalLink(href)) return <a aria-label={label} className={className} href={href} onClick={onClick} rel="noopener noreferrer" target="_blank">{children}</a>;
  if (!href.startsWith("/")) return <a aria-label={label} className={className} href={href} onClick={onClick}>{children}</a>;
  return <SiteLink aria-label={label} className={className} href={href} onClick={onClick}>{children}</SiteLink>;
}

// Khi bật cả hai, quảng cáo được ưu tiên. Sau khi quảng cáo đã được đóng/nhấp,
// biểu mẫu tư vấn có thể xuất hiện ở lần xem trang phù hợp tiếp theo.
export function ConsultPopup({ popup, image, hotline }: Props) {
  const pathname = usePathname();
  const [opened, setOpened] = useState<OpenedPopup | null>(null);
  const open = opened?.pathname === pathname;
  const contactPage = pathname === "/lien-he" || pathname.startsWith("/lien-he/");
  const scopeEligible = !contactPage && (popup.scope === "all" || pathname === "/");
  const promoEligible = scopeEligible && popup.promo.enabled && Boolean(popup.promo.actionUrl);
  const formEligible = scopeEligible && popup.form.enabled;
  const eligible = promoEligible || formEligible;
  const promoKey = consultPopupStorageKey(popup, "promo");
  const formKey = consultPopupStorageKey(popup, "form");
  const { scrollPercent, delaySeconds } = popup;

  useEffect(() => {
    if (!eligible) return;
    const candidates: OpenedPopup[] = [];
    if (promoEligible) candidates.push({ pathname, kind: "promo", storageKey: promoKey });
    if (formEligible) candidates.push({ pathname, kind: "form", storageKey: formKey });
    const candidate = candidates.find((item) => !suppressed(item.storageKey));
    if (!candidate) return;

    const startedAt = Date.now();
    let scrolled = window.scrollY > 0;
    let done = false;
    let timer: number | undefined;
    const check = () => {
      if (done || !scrolled || document.hidden) return;
      const page = document.documentElement;
      if (consultPopupScrollProgress({ scrollY: window.scrollY, innerHeight: window.innerHeight, scrollHeight: page.scrollHeight }) < scrollPercent) return;
      const wait = startedAt + delaySeconds * 1000 - Date.now();
      if (wait > 0) { window.clearTimeout(timer); timer = window.setTimeout(check, wait + 30); return; }
      done = true;
      setOpened(candidate);
    };
    const onScroll = () => { scrolled = true; check(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    check();
    return () => { window.removeEventListener("scroll", onScroll); window.clearTimeout(timer); };
  }, [delaySeconds, eligible, formEligible, formKey, pathname, promoEligible, promoKey, scrollPercent]);

  const close = useCallback((days: number) => {
    if (opened) remember(opened.storageKey, days);
    setOpened(null);
  }, [opened]);
  if (!open || !opened || !eligible) return null;
  return <Dialog close={close} hotline={hotline} image={image} kind={opened.kind} pathname={pathname} popup={popup} storageKey={opened.storageKey} />;
}

function Dialog({ popup, image, hotline, pathname, close, kind, storageKey }: Props & { pathname: string; close: (days: number) => void; kind: ConsultPopupKind; storageKey: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const dismiss = useCallback(() => close(popup.repeatDays), [close, popup.repeatDays]);
  const promo = kind === "promo";
  const title = promo ? popup.promo.title : popup.form.title;
  const description = promo ? popup.promo.description : popup.form.description;
  const banner = promo && popup.promo.layout === "image" && image !== null;
  const promoPresentation = consultPopupPromoPresentation(popup);
  const showCopy = !promo || promoPresentation.showCopy;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (promo) panel.current?.focus({ preventScroll: true });
    else panel.current?.querySelector<HTMLElement>("input, select")?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss(); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(focusable)];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, [dismiss, promo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await submitLead({ name: String(data.name ?? ""), phone: String(data.phone ?? ""), email: "", need: String(data.need ?? ""), message: `Gửi từ cửa sổ tư vấn · ${pathname}`, website: String(data.website ?? "") });
    setBusy(false);
    if (result.ok) { setSuccess(true); remember(storageKey, submittedDays); }
    else setMessage(result.message);
  }

  const href = popup.promo.actionUrl ?? "/";
  const external = isPopupExternalLink(href);
  const panelClass = banner ? "consult-popup__panel consult-popup__panel--banner" : promo ? "consult-popup__panel consult-popup__panel--promo" : "consult-popup__panel";
  return <div className="consult-popup" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }} role="presentation">
    <div aria-describedby={!banner && showCopy && description ? descriptionId : undefined} aria-label={banner || !showCopy ? title : undefined} aria-labelledby={banner || !showCopy ? undefined : titleId} aria-modal="true" className={panelClass} data-testid="consult-popup-dialog" ref={panel} role="dialog" tabIndex={-1}>
      <button aria-label="Đóng cửa sổ" className={banner ? "consult-popup__close consult-popup__close--float" : "consult-popup__close"} onClick={dismiss} type="button"><X aria-hidden="true" size={20} /></button>
      {banner && image
        ? <PromoLink className="consult-popup__banner group" href={href} label={`${title}${external ? " (mở trang ngoài)" : ""}`} onClick={() => close(popup.repeatDays)}>
          {image.width && image.height
            ? <Image alt="" className="consult-popup__banner-image" height={image.height} sizes="(min-width: 640px) 480px, 92vw" src={image.url} width={image.width} />
            : <span className="consult-popup__banner-fallback"><Image alt="" className="object-cover" fill sizes="(min-width: 640px) 480px, 92vw" src={image.url} /></span>}
        </PromoLink>
        : <>
          {promo && image ? <div className="consult-popup__media"><Image alt={image.alt} className="consult-popup__media-image" fill sizes="(min-width: 640px) 512px, 100vw" src={image.url} /></div> : null}
          <div className={promo ? showCopy ? "consult-popup__body consult-popup__body--promo" : "consult-popup__body consult-popup__body--promo consult-popup__body--compact" : "consult-popup__body"}>
            {success ? <div aria-live="polite" className="grid justify-items-center gap-3 py-6 text-center" role="status">
              <CircleCheck aria-hidden="true" className="text-accent-green" size={44} />
              <p className="mb-0 text-h3 font-bold text-ink">Đã nhận thông tin của bạn</p>
              <p className="mb-0 text-body text-muted">iOrder sẽ gọi lại trong giờ làm việc.</p>
              <button className="button button--secondary mt-2" onClick={() => close(submittedDays)} type="button">Đóng</button>
            </div> : <>
              {promo ? null : <p className="consult-popup__eyebrow">Tư vấn iOrder</p>}
              {showCopy ? <h2 className="mb-0 text-h3 font-bold tracking-tight text-balance text-ink" id={titleId}>{title}</h2> : null}
              {showCopy && description ? <p className="mb-0 text-body text-muted" id={descriptionId}>{description}</p> : null}
              {promo
                ? <div className="flex flex-wrap items-center gap-3">
                  <PromoLink className={showCopy ? "button button--primary" : "button button--primary consult-popup__promo-cta"} href={href} onClick={() => close(popup.repeatDays)}>{promoPresentation.actionLabel}{external ? <ExternalLink aria-hidden="true" size={18} /> : <ArrowRight aria-hidden="true" size={18} />}</PromoLink>
                  {showCopy ? <button className="button button--secondary" onClick={dismiss} type="button">Để sau</button> : null}
                </div>
                : <form aria-label="Đăng ký nhận tư vấn" className="grid gap-4" onSubmit={submit}>
                  <Field label="Họ và tên" required><input autoComplete="name" className={inputClassName} name="name" placeholder="Nguyễn Văn A" required /></Field>
                  <Field label="Số điện thoại" required><input autoComplete="tel" className={inputClassName} inputMode="tel" name="phone" placeholder="09xx xxx xxx" required /></Field>
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
