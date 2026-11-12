"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui";

export type HeroSlide = { url: string; alt: string; title: string | null; description: string | null; action: { label: string; href: string } | null };

const interval = 6000;

// Phần đầu trang kiểu "Trượt nhiều ảnh": tự chuyển 6 giây/ảnh, dừng khi rê chuột, khi đang thao tác bàn phím
// hoặc khi người dùng bật giảm chuyển động; mũi tên, chấm và phím ←/→ để chuyển tay.
export function HeroSlider({ slides, priority }: { slides: HeroSlide[]; priority: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const count = slides.length;
  const go = useCallback((index: number) => setActive((index + count) % count), [count]);

  useEffect(() => { reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);
  useEffect(() => {
    if (count < 2 || paused || reducedMotion.current) return;
    const timer = window.setTimeout(() => go(active + 1), interval);
    return () => window.clearTimeout(timer);
  }, [active, count, go, paused]);

  return <div aria-label="Ảnh nổi bật" aria-roledescription="carousel" className="hero-slider" onBlur={() => setPaused(false)} onFocus={() => setPaused(true)} onKeyDown={(event) => { if (event.key === "ArrowLeft") go(active - 1); if (event.key === "ArrowRight") go(active + 1); }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} role="region">
    {slides.map((slide, index) => <div aria-hidden={index !== active} aria-label={`${index + 1} / ${count}`} aria-roledescription="slide" className={index === active ? "hero-slider__slide hero-slider__slide--active" : "hero-slider__slide"} key={`${slide.url}-${index}`} role="group">
      <Image alt={slide.alt} className="object-cover" data-builder-field="image" data-builder-item={`slides:${index}`} fill priority={priority && index === 0} sizes="100vw" src={slide.url} />
      {slide.title || slide.description || slide.action ? <div className="hero-slider__overlay"><div className="site-container">
        <div className="max-w-2xl">
          {slide.title ? <p className="mb-0 text-3xl leading-tight font-bold tracking-tight text-white sm:text-5xl" data-builder-field="title" data-builder-item={`slides:${index}`}>{slide.title}</p> : null}
          {slide.description ? <p className="mt-4 text-base leading-7 text-white/90 sm:text-lg sm:leading-8" data-builder-field="description" data-builder-item={`slides:${index}`}>{slide.description}</p> : null}
          {slide.action ? <div className="mt-6"><ButtonLink action={slide.action} field="action" tabIndex={index === active ? 0 : -1} /></div> : null}
        </div>
      </div></div> : null}
    </div>)}
    {count > 1 ? <>
      <button aria-label="Ảnh trước" className="hero-slider__arrow hero-slider__arrow--prev" onClick={() => go(active - 1)} type="button"><ChevronLeft aria-hidden="true" size={28} /></button>
      <button aria-label="Ảnh sau" className="hero-slider__arrow hero-slider__arrow--next" onClick={() => go(active + 1)} type="button"><ChevronRight aria-hidden="true" size={28} /></button>
      <div className="hero-slider__dots">{slides.map((_, index) => <button aria-current={index === active} aria-label={`Xem ảnh ${index + 1}`} className={index === active ? "hero-slider__dot hero-slider__dot--active" : "hero-slider__dot"} key={index} onClick={() => go(index)} type="button" />)}</div>
    </> : null}
  </div>;
}
