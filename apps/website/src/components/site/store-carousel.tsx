"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteLink } from "./site-link";
import { nextSliderIndex, previousSliderIndex, sliderIndexFromScroll, sliderPages } from "@/lib/slider-math";
import { useT } from "./messages-provider";

export type CarouselSlide = { title: string; description: string | null; href: string | null; image: { url: string; alt: string; kind: "photo" | "cutout" } | null };

const interval = 4500;

// Dải ảnh trượt tự động: ảnh nối nhau theo chiều ngang, tự trượt sang ảnh kế tiếp mỗi vài giây rồi quay về đầu.
// Rê chuột hoặc dùng bàn phím vào ảnh thì dải dừng và hiện nội dung (tên, mô tả, "Xem thêm"); màn hình cảm ứng luôn hiện nội dung
// ở chân ảnh. Dừng khi ngoài màn hình, tab bị ẩn hoặc người dùng bật giảm chuyển động; có nút Tạm dừng, nút trước/sau và chấm chuyển ảnh.
// `variant="quad"`: dải cuối của lưới ảnh thực tế, hiện 4 ảnh cùng lúc (khớp các ô phía trên) và luôn hiện tên; `firstIndex`: vị trí của ảnh đầu dải trong danh sách thẻ gốc (cho trình dựng trang).
// `eager`: dải nằm trong màn hình đầu hoặc đang xem trước trong CMS → ảnh đầu được ưu tiên tải, hai ảnh kế tải ngay; còn lại vẫn lazy.
export function StoreCarousel({ slides, label, variant, firstIndex = 0, eager = false }: { slides: CarouselSlide[]; label: string; variant?: "quad"; firstIndex?: number; eager?: boolean }) {
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [pages, setPages] = useState(Math.max(1, slides.length));
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const step = useRef(0);

  const measure = useCallback(() => {
    const element = track.current;
    const first = element?.firstElementChild as HTMLElement | null;
    if (!element || !first) return;
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
    step.current = first.offsetWidth + gap;
    const visible = Math.max(1, Math.round((element.clientWidth + gap) / step.current));
    setPages(sliderPages(slides.length, visible));
  }, [slides.length]);

  useEffect(() => {
    measure();
    const element = track.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = track.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback((index: number) => {
    track.current?.scrollTo({ left: index * step.current, behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);

  // Vị trí đang xem theo thanh cuộn (kể cả khi người dùng tự vuốt).
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setActive(sliderIndexFromScroll(element.scrollLeft, step.current, pages)));
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => { element.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [pages]);

  const running = playing && !hovered && inView && !reducedMotion && pages > 1;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      if (document.hidden) return;
      goTo(nextSliderIndex(active, pages));
    }, interval);
    return () => window.clearTimeout(timer);
  }, [running, active, pages, goTo]);

  return <div
    aria-label={label}
    aria-roledescription="carousel"
    className={variant === "quad" ? "slider slider--quad" : "slider"}
    onBlur={() => setHovered(false)}
    onFocus={() => setHovered(true)}
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
    role="region"
  >
    <div className="slider__track" ref={track}>
      {slides.map((slide, index) => {
        const content = <>
          {slide.image ? <span className={`slider__media slider__media--${slide.image.kind}`}><Image alt={slide.image.alt} className={slide.image.kind === "photo" ? "object-cover transition duration-700 group-hover:scale-[1.04]" : "object-contain transition duration-500 group-hover:scale-[1.03]"} fill loading={eager && index > 0 && index < 3 ? "eager" : undefined} preload={eager && index === 0} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 85vw" src={slide.image.url} /></span> : null}
          <span aria-hidden="true" className="slider__scrim" />
          <span className="slider__caption">
            <strong data-builder-field="title">{slide.title}</strong>
            {slide.description ? <span className="slider__text" data-builder-field="description">{slide.description}</span> : null}
            {slide.href ? <span aria-hidden="true" className="slider__more">{t("common.viewMore")}</span> : null}
          </span>
        </>;
        return <div aria-label={`${index + 1} / ${slides.length}`} aria-roledescription="slide" className="slider__item" data-builder-item={`items:${firstIndex + index}`} key={`${slide.title}-${index}`} role="group">
          {slide.href
            ? <SiteLink className="slider__link group" data-builder-field="href" data-kind={slide.image?.kind ?? "photo"} href={slide.href}>{content}</SiteLink>
            : <div className="slider__link group" data-kind={slide.image?.kind ?? "photo"}>{content}</div>}
        </div>;
      })}
    </div>
    {pages > 1 ? <div className="slider__controls">
      <div aria-label={t("slider.selectImage")} className="slider__dots" role="group">
        {Array.from({ length: pages }, (_, index) => <button aria-current={index === active ? "true" : undefined} aria-label={t("slider.image", { n: index + 1 })} className="slider__dot" key={index} onClick={() => goTo(index)} type="button" />)}
      </div>
      <div className="slider__buttons">
        <button aria-label={playing ? t("slider.pause") : t("slider.play")} className="slider__button" onClick={() => setPlaying(value => !value)} type="button">{playing ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}</button>
        <button aria-label={t("slider.prevImage")} className="slider__button" onClick={() => goTo(previousSliderIndex(active, pages))} type="button"><ArrowLeft aria-hidden="true" size={18} /></button>
        <button aria-label={t("slider.nextImage")} className="slider__button" onClick={() => goTo(nextSliderIndex(active, pages))} type="button"><ArrowRight aria-hidden="true" size={18} /></button>
      </div>
    </div> : null}
  </div>;
}
