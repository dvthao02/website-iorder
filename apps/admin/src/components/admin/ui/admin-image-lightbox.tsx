"use client";

import { X } from "lucide-react";
import { useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useAdminFocusTrap } from "./admin-focus-trap";

const noSubscribe = () => () => undefined;
// Vẽ vào .admin-shell như AdminSidePanel để nằm trên mọi thanh sticky và vẫn nhận kiểu CMS.
const shellHost = () => document.querySelector(".admin-shell") ?? document.body;
const noHost = () => null;

// Xem ảnh lớn giữa màn hình. "peek" (rê chuột) chỉ hiện ảnh, không bắt chuột hay focus;
// "open" (bấm) là hộp thoại có nút đóng, Esc và bấm nền để đóng.
export function AdminImageLightbox({ alt, caption, mode, onClose, src }: {
  alt: string;
  caption?: string;
  mode: "peek" | "open" | null;
  onClose: () => void;
  src: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const host = useSyncExternalStore(noSubscribe, shellHost, noHost);
  useAdminFocusTrap({ containerRef: dialogRef, isOpen: mode === "open", onClose });
  if (!mode || !host) return null;

  const isOpen = mode === "open";
  return createPortal(<div aria-hidden={isOpen ? undefined : true} className={isOpen ? "admin-image-lightbox" : "admin-image-lightbox admin-image-lightbox--peek"} onMouseDown={isOpen ? onClose : undefined} role="presentation">
    <div aria-label={caption ?? "Xem ảnh"} aria-modal={isOpen ? true : undefined} className="admin-image-lightbox__dialog" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role={isOpen ? "dialog" : undefined} tabIndex={-1}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh xem lớn trong CMS */}
      <img alt={alt} src={src} />
      {caption || isOpen ? <div className="admin-image-lightbox__bar">
        {caption ? <span title={caption}>{caption}</span> : <span />}
        {isOpen ? <button aria-label="Đóng xem ảnh" className="admin-image-lightbox__close" onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button> : null}
      </div> : null}
    </div>
  </div>, host);
}
