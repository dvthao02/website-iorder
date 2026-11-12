"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const interval = 6000;

// Phần đầu trang có nhiều khối nội dung: cả chữ và ảnh trượt cùng nhau, 6 giây/khối.
// Các khối chồng lên nhau trong một ô lưới nên phần đầu trang cao theo khối cao nhất, không nhảy khi chuyển.
// Dừng khi rê chuột/đang thao tác bàn phím hoặc khi người dùng bật giảm chuyển động; mũi tên, chấm, phím ←/→ để chuyển tay.
// `fade`: chỉ mờ dần, không trượt ngang (kiểu ảnh nền: ảnh phủ kín phần đầu trang, trượt ngang sẽ lộ mép).
export function HeroRotator({ panels, dark = false, fade = false, center = false }: { panels: ReactNode[]; dark?: boolean; fade?: boolean; center?: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const count = panels.length;
  const go = (index: number) => setActive((index + count) % count);

  useEffect(() => { reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);
  useEffect(() => {
    if (count < 2 || paused || reducedMotion.current) return;
    const timer = window.setTimeout(() => setActive((active + 1) % count), interval);
    return () => window.clearTimeout(timer);
  }, [active, count, paused]);

  const panelClass = (index: number) => ["hero-rotator__panel", index === active ? "hero-rotator__panel--active" : index < active ? "hero-rotator__panel--before" : ""].join(" ").trim();
  return <div aria-label="Nội dung nổi bật" aria-roledescription="carousel" className={`hero-rotator ${fade ? "hero-rotator--fade" : ""} ${dark ? "hero-rotator--dark" : ""}`.trim()} onBlur={() => setPaused(false)} onFocus={() => setPaused(true)} onKeyDown={(event) => { if (event.key === "ArrowLeft") go(active - 1); if (event.key === "ArrowRight") go(active + 1); }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} role="region">
    <div className="hero-rotator__stack">
      {panels.map((panel, index) => <div aria-hidden={index !== active} aria-label={`${index + 1} / ${count}`} aria-roledescription="slide" className={panelClass(index)} inert={index !== active} key={index} role="group">{panel}</div>)}
    </div>
    <div className={`hero-rotator__nav ${center ? "justify-center" : ""}`}>
      <button aria-label="Khối trước" className="hero-rotator__arrow" onClick={() => go(active - 1)} type="button"><ChevronLeft aria-hidden="true" size={20} /></button>
      <div className="hero-rotator__dots">{panels.map((_, index) => <button aria-current={index === active} aria-label={`Xem khối ${index + 1}`} className={index === active ? "hero-rotator__dot hero-rotator__dot--active" : "hero-rotator__dot"} key={index} onClick={() => go(index)} type="button" />)}</div>
      <button aria-label="Khối sau" className="hero-rotator__arrow" onClick={() => go(active + 1)} type="button"><ChevronRight aria-hidden="true" size={20} /></button>
    </div>
  </div>;
}
