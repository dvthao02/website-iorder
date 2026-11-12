"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from "react";

const defaultActive = '[aria-current="page"], [aria-current="location"]';

/**
 * Thanh trượt dọc "|" cho danh sách liên kết (danh mục hướng dẫn, mục lục bài viết): vạch xanh nằm cạnh mục đang chọn
 * (`aria-current`), trượt tới mục đang rê chuột/focus và trượt về khi rời ra — cùng cách hoạt động với vạch dưới menu đầu trang.
 * Tự đo lại khi mục đang chọn đổi (mục lục cuộn tới đâu tô tới đó), khi nhóm gập/mở (<details>) hoặc khung đổi cỡ.
 * Mục đang chọn nằm trong nhóm đang gập thì ẩn vạch. Vạch đặt ở mép trái khung; đường kẻ nền do CSS của nơi dùng vẽ.
 */
export function SlidingRail({ children, className = "", itemSelector = "a", activeSelector = defaultActive }: { children: ReactNode; className?: string; itemSelector?: string; activeSelector?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const hovered = useRef<HTMLElement | null>(null);
  const [bar, setBar] = useState({ top: 0, height: 0, visible: false, instant: true });

  const place = useCallback(() => {
    const element = root.current;
    if (!element) return;
    const target = hovered.current ?? element.querySelector<HTMLElement>(activeSelector);
    // Mục nằm trong nhóm đang gập (<details> đóng) vẫn có thể còn khung đo được, nên kiểm tra thẳng.
    if (!target || target.closest("details:not([open])") || target.getClientRects().length === 0) { setBar((current) => ({ ...current, visible: false, instant: true })); return; }
    const box = element.getBoundingClientRect(), item = target.getBoundingClientRect();
    setBar((current) => ({ top: item.top - box.top, height: item.height, visible: true, instant: !current.visible }));
  }, [activeSelector]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    place();
    const resize = new ResizeObserver(place);
    resize.observe(element);
    const mutation = new MutationObserver(place);
    mutation.observe(element, { attributes: true, attributeFilter: ["aria-current", "open"], subtree: true });
    void document.fonts?.ready.then(place);
    return () => { resize.disconnect(); mutation.disconnect(); };
  }, [place]);

  const pick = (event: MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
    const item = (event.target as Element).closest<HTMLElement>(itemSelector);
    if (!item || !event.currentTarget.contains(item) || item === hovered.current) return;
    hovered.current = item;
    place();
  };
  const release = () => { hovered.current = null; place(); };

  return <div className={`sliding-rail ${className}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) release(); }} onFocus={pick} onMouseLeave={release} onMouseOver={pick} ref={root}>
    {children}
    <span aria-hidden="true" className="sliding-rail__bar" data-instant={bar.instant} data-visible={bar.visible} style={{ height: bar.height, transform: `translateY(${bar.top}px)` }} />
  </div>;
}
