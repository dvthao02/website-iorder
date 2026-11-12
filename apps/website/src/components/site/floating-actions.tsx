"use client";

import { ArrowUp, Mail, MessageCircle, Phone, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FacebookIcon, ZaloIcon } from "./brand-icons";

type Contact = { hotline: string | null; zalo: string | null; email: string | null; facebook: string | null };
type Action = { key: string; href: string; label: string; icon: ReactNode; external: boolean };

// Nút nổi: góc phải là bong bóng liên hệ (bấm để mở Facebook / Email / Zalo / Gọi), góc trái là nút lên đầu trang.
// Mọi nút cùng một cỡ (biến --float-size trong globals.css, nhỏ dần theo màn hình). Dữ liệu lấy từ cài đặt CMS.
export function FloatingActions({ hotline, zalo, email, facebook }: Contact) {
  const [open, setOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const root = useRef<HTMLElement>(null);
  const candidates: Array<Action | null> = [
    facebook ? { key: "facebook", href: facebook, label: "Facebook", icon: <FacebookIcon size={26} />, external: true } : null,
    email ? { key: "email", href: `mailto:${email}`, label: `Email: ${email}`, icon: <Mail aria-hidden="true" size={20} />, external: false } : null,
    zalo ? { key: "zalo", href: zalo, label: "Chat Zalo", icon: <ZaloIcon size={26} />, external: true } : null,
    hotline ? { key: "hotline", href: `tel:${hotline.replace(/[^\d+]/g, "")}`, label: `Gọi ${hotline}`, icon: <Phone aria-hidden="true" size={20} />, external: false } : null,
  ];
  const actions = candidates.filter((action): action is Action => action !== null);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onPointer); };
  }, [open]);

  return <>
    {actions.length ? <aside aria-label="Liên hệ nhanh" className={open ? "floating-contact floating-contact--open" : "floating-contact"} ref={root}>
      <ul aria-hidden={!open} className="floating-contact__menu" id="floating-contact-menu">{actions.map((action) => <li key={action.key}>
        <a aria-label={action.label} className={`floating-action floating-action--${action.key}`} data-label={action.label} href={action.href} rel={action.external ? "noopener noreferrer" : undefined} tabIndex={open ? 0 : -1} target={action.external ? "_blank" : undefined}>{action.icon}</a>
      </li>)}</ul>
      <button aria-controls="floating-contact-menu" aria-expanded={open} aria-label={open ? "Đóng liên hệ nhanh" : "Mở liên hệ nhanh"} className="floating-contact__toggle" onClick={() => setOpen((value) => !value)} type="button">{open ? <X aria-hidden="true" size={22} /> : <MessageCircle aria-hidden="true" size={22} />}</button>
    </aside> : null}
    <button aria-label="Lên đầu trang" className={showTop ? "floating-top floating-top--visible" : "floating-top"} onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })} tabIndex={showTop ? 0 : -1} title="Lên đầu trang" type="button"><ArrowUp aria-hidden="true" size={20} /></button>
  </>;
}
