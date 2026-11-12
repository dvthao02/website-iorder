"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type HeroImage = { url: string; alt: string };

const interval = 5000;

// Nhiều ảnh của phần đầu trang kiểu chữ – ảnh, ảnh nền, chữ ở giữa: chuyển mờ dần 5 giây/ảnh, chữ giữ nguyên.
// `fill`: ảnh phủ kín phần đầu trang (kiểu ảnh nền; thẻ cha phải `relative isolate`); `inline`: ảnh trong khung, cao theo ảnh cao nhất.
// Dừng khi rê chuột/đang thao tác bàn phím hoặc khi người dùng bật giảm chuyển động; chấm để xem từng ảnh.
// `onLight`: ảnh nền phủ lớp sáng, chấm dùng màu đậm như kiểu `inline`.
export function HeroImages({ images, priority, variant, sizes, className = "", imageClassName = "h-auto w-full", onLight = false }: { images: HeroImage[]; priority: boolean; variant: "fill" | "inline"; sizes: string; className?: string; imageClassName?: string; onLight?: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const count = images.length;

  useEffect(() => { reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);
  useEffect(() => {
    if (count < 2 || paused || reducedMotion.current) return;
    const timer = window.setTimeout(() => setActive((active + 1) % count), interval);
    return () => window.clearTimeout(timer);
  }, [active, count, paused]);

  const pause = { onBlur: () => setPaused(false), onFocus: () => setPaused(true), onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false) };
  const fill = variant === "fill";
  return <div className={`hero-images hero-images--${variant} ${onLight ? "hero-images--on-light" : ""} ${className}`} {...(fill ? {} : pause)}>
    <div className="hero-images__stack">
      {images.map((image, index) => <div aria-hidden={index !== active} className={index === active ? "hero-images__item hero-images__item--active" : "hero-images__item"} key={`${image.url}-${index}`}>
        {fill
          ? <Image alt={image.alt} className="object-cover" fill priority={priority && index === 0} sizes={sizes} src={image.url} />
          : <Image alt={image.alt} className={imageClassName} height={800} priority={priority && index === 0} sizes={sizes} src={image.url} width={1200} />}
      </div>)}
    </div>
    {count > 1 ? <div className="hero-images__dots" {...(fill ? pause : {})}>{images.map((_, index) => <button aria-current={index === active} aria-label={`Xem ảnh ${index + 1}`} className={index === active ? "hero-images__dot hero-images__dot--active" : "hero-images__dot"} key={index} onClick={() => setActive(index)} type="button" />)}</div> : null}
  </div>;
}
