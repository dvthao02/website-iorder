"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SiteLink } from "./site-link";
import { HeroImages, type HeroImage } from "./hero-images";

export type ProcessStep = { title: string; description: string; href: string | null; images: HeroImage[] };

// Mỗi ảnh hiện từng này mili giây; xem hết ảnh của một bước thì mới sang bước kế.
const interval = 6000;

// Quy trình dạng trượt: bên trái là tiêu đề của khối và danh sách bước (bước đang chọn mở mô tả ngay bên dưới),
// bên phải là ảnh minh họa (nền trong suốt, không khung) trượt ngang theo bước; tỉ lệ cột 60/40. Tự chuyển bước sau vài giây; dừng khi rê chuột/đang thao tác
// bàn phím hoặc khi người dùng bật giảm chuyển động. Bước có nhiều ảnh thì chạy hết ảnh của bước đó rồi mới chuyển bước.
// `heading`: phần tiêu đề của khối (dựng ở server), đặt cùng cột với danh sách bước để cả khối gọn trong một màn.
export function ProcessStepper({ steps, heading = null, dark = false }: { steps: ProcessStep[]; heading?: ReactNode; dark?: boolean }) {
  const [position, setPosition] = useState({ step: 0, image: 0 });
  const active = position.step;
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const listRef = useRef<HTMLOListElement>(null);
  // Chiều cao dự phòng để cột chữ luôn cao như nhau dù mô tả bước đang mở dài hay ngắn: khung ảnh cao bằng cột chữ nên không bị nhảy.
  const [reserve, setReserve] = useState(0);
  const count = steps.length;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const heights = Array.from(list.querySelectorAll<HTMLElement>(".process-stepper__more > div")).map(element => element.scrollHeight - (parseFloat(getComputedStyle(element).paddingBottom) || 0));
      setReserve(Math.max(0, Math.max(0, ...heights) - (heights[active] ?? 0)));
    };
    measure();
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, steps]);
  useEffect(() => { reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);
  useEffect(() => {
    const frames = steps.reduce((sum, step) => sum + Math.max(1, step.images.length), 0);
    if (frames < 2 || paused || reducedMotion.current) return;
    const timer = window.setTimeout(() => setPosition(current => {
      const imageCount = Math.max(1, steps[current.step]?.images.length ?? 1);
      return current.image + 1 < imageCount ? { step: current.step, image: current.image + 1 } : { step: (current.step + 1) % count, image: 0 };
    }), interval);
    return () => window.clearTimeout(timer);
  }, [position, count, paused, steps]);

  const pause = { onBlur: () => setPaused(false), onFocus: () => setPaused(true), onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false) };
  return <div className={`process-stepper grid items-start gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-stretch lg:gap-16 ${dark ? "process-stepper--dark" : ""}`} {...pause}>
    <div>
      {heading}
      <ol aria-label="Các bước" className="process-stepper__list" ref={listRef} style={{ paddingBottom: reserve }}>
        {steps.map((step, index) => {
          const current = index === active;
          return <li className={current ? "process-stepper__item process-stepper__item--active" : "process-stepper__item"} data-builder-item={`items:${index}`} key={`${step.title}-${index}`}>
            <button aria-current={current ? "step" : undefined} aria-expanded={current} className="process-stepper__step" onClick={() => setPosition({ step: index, image: 0 })} type="button">
              <span className="process-stepper__number">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0 text-left" data-builder-field="title">{step.title}</span>
            </button>
            <div className="process-stepper__more" inert={!current}>
              <div>
                {step.description ? <p className="m-0 whitespace-pre-line" data-builder-field="description">{step.description}</p> : null}
                {step.href ? <SiteLink className="process-stepper__link" data-builder-field="href" href={step.href}>Xem thêm →</SiteLink> : null}
              </div>
            </div>
          </li>;
        })}
      </ol>
    </div>
    <div className="process-stepper__stage">
      <div className="process-stepper__track" style={{ transform: `translateX(-${active * 100}%)` }}>
        {steps.map((step, index) => <div aria-hidden={index !== active} className="process-stepper__slide" data-builder-item={`items:${index}`} inert={index !== active} key={`${step.title}-${index}`}>
          {step.images.length
            ? <HeroImages builderItem={null} className="process-stepper__images" imageClassName="object-contain p-2" images={step.images} index={index === active ? position.image : 0} onLight preload={false} sizes="(min-width: 1024px) 520px, 100vw" variant="cover" />
            : <span aria-hidden="true" className="process-stepper__empty">{String(index + 1).padStart(2, "0")}</span>}
        </div>)}
      </div>
    </div>
  </div>;
}
