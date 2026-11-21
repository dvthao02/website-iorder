"use client";

import { Info } from "lucide-react";
import React, { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const gap = 6;
const edge = 8;

/**
 * Bao một ô kiểu `<label className="admin-field">…</label>` để thêm chú thích ⓘ ở góc phải hàng nhãn.
 * Nút nằm ngoài label nên tên truy cập của ô nhập vẫn chỉ là nhãn.
 */
export function AdminHintedField({ children, hint, label }: { children: ReactNode; hint?: ReactNode; label: string }) {
  // Giữ nguyên khung khi `hint` lúc có lúc không, để ô nhập bên trong không bị dựng lại (mất focus).
  return <div className="admin-field">{children}{hint ? <AdminHelpTip className="admin-help-tip--corner" label={`Giải thích: ${label}`}>{hint}</AdminHelpTip> : null}</div>;
}

/**
 * Chú thích phụ của một trường hoặc mục: chỉ hiện biểu tượng ⓘ cạnh nhãn, nội dung mở khi rê chuột,
 * focus bàn phím hoặc chạm (Esc để đóng). Dùng cho lời giải thích cố định; trạng thái, cảnh báo và lỗi
 * phải hiện sẵn trên màn hình, không đưa vào đây.
 *
 * Bóng chú thích vẽ qua portal với `position: fixed` nên không bị `overflow` của thẻ hay `transform` của
 * panel trượt cắt hoặc lệch.
 */
export function AdminHelpTip({ children, className = "", label = "Xem giải thích" }: {
  children: ReactNode;
  className?: string;
  /** Tên cho trình đọc màn hình; nên nói rõ chú thích về mục nào. */
  label?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [escaped, setEscaped] = useState(false);
  const open = (hover || focus) && !escaped;

  // Đặt bóng sát biểu tượng, lật lên trên khi hết chỗ phía dưới, và luôn nằm trọn trong cửa sổ.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const box = bubble.current;
      if (!anchor || !box) return;
      const { width, height } = box.getBoundingClientRect();
      const fitsBelow = anchor.bottom + gap + height <= window.innerHeight - edge;
      const top = fitsBelow ? anchor.bottom + gap : Math.max(edge, anchor.top - gap - height);
      const left = Math.min(Math.max(edge, anchor.left + anchor.width / 2 - width / 2), Math.max(edge, window.innerWidth - width - edge));
      box.style.top = `${top}px`;
      box.style.left = `${left}px`;
      box.style.visibility = "visible";
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Esc đóng được cả khi chỉ đang rê chuột (con trỏ không nằm trên nút).
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setEscaped(true); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return <>
    <button
      aria-describedby={open ? id : undefined}
      aria-label={label}
      className={`admin-help-tip ${className}`.trim()}
      onBlur={() => setFocus(false)}
      onFocus={() => { setFocus(true); setEscaped(false); }}
      onMouseEnter={() => { setHover(true); setEscaped(false); }}
      onMouseLeave={() => setHover(false)}
      ref={trigger}
      type="button"
    ><Info aria-hidden="true" size={14} /></button>
    {open ? createPortal(<span className="admin-help-tip__bubble" id={id} ref={bubble} role="tooltip">{children}</span>, document.body) : null}
  </>;
}
