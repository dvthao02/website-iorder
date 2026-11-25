"use client";

import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { FitImage } from "./fit-image";
import { useT } from "./messages-provider";

export type HeroImage = { url: string; alt: string };

const interval = 5000;

// Nhiều ảnh của phần đầu trang kiểu chữ – ảnh, ảnh nền, chữ ở giữa: chuyển mờ dần 5 giây/ảnh, chữ giữ nguyên.
// `fill`: ảnh phủ kín phần đầu trang (kiểu ảnh nền; thẻ cha phải `relative isolate`); `inline`: ảnh trong khung, cao theo ảnh cao nhất.
// Dừng khi rê chuột/đang thao tác bàn phím hoặc khi người dùng bật giảm chuyển động; chấm để xem từng ảnh.
// `onLight`: ảnh nền phủ lớp sáng, chấm dùng màu đậm như kiểu `inline`.
// `builderItem`: mã mục con gắn trên ảnh để bấm trên canvas CMS chọn đúng chỗ (phần đầu trang: "hero.primary"; khối khác: không có mã).
// `fit="contain"` (chỉ kiểu `cover`): mỗi ảnh hiện đủ trong khung bằng FitImage (không cắt, phần thừa liền màu ảnh); mặc định "cover" giữ nguyên cách cũ (`imageClassName` quyết định).
export function HeroImages({ images, preload, variant, sizes, className = "", imageClassName = "h-auto w-full", onLight = false, builderItem = "hero.primary", index, fit = "cover" }: { images: HeroImage[]; preload: boolean; variant: "fill" | "inline" | "cover"; sizes: string; className?: string; imageClassName?: string; onLight?: boolean; builderItem?: string | null; index?: number; fit?: "cover" | "contain" }) {
  const t = useT();
  // `index`: nơi dùng điều khiển ảnh đang xem (ví dụ quy trình trượt xem hết ảnh của bước rồi mới sang bước khác); khi đó không tự chuyển ảnh.
  const [ownActive, setActive] = useState(0);
  const controlled = index !== undefined;
  const active = controlled ? Math.min(index, Math.max(0, images.length - 1)) : ownActive;
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const count = images.length;

  useEffect(() => { reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);
  useEffect(() => {
    if (controlled || count < 2 || paused || reducedMotion.current) return;
    const timer = window.setTimeout(() => setActive((active + 1) % count), interval);
    return () => window.clearTimeout(timer);
  }, [active, controlled, count, paused]);

  const pause = { onBlur: () => setPaused(false), onFocus: () => setPaused(true), onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false) };
  // `cover`: ảnh phủ kín khung cha có sẵn (ảnh thẻ): chấm chỉ báo vị trí, không bấm được vì thẻ cha có thể là liên kết.
  const fill = variant !== "inline";
  const cover = variant === "cover";
  return <div className={`hero-images hero-images--${variant} ${onLight ? "hero-images--on-light" : ""} ${className}`} {...(variant === "fill" ? {} : pause)}>
    <div className="hero-images__stack">
      {images.map((image, index) => <div aria-hidden={index !== active} className={index === active ? "hero-images__item hero-images__item--active" : "hero-images__item"} key={`${image.url}-${index}`}>
        {fill
          ? cover && fit === "contain"
            ? <FitImage alt={image.alt} builderField="image" builderItem={builderItem ?? undefined} className={imageClassName} preload={preload && index === 0} sizes={sizes} url={image.url} />
            : <Image alt={image.alt} className={cover ? imageClassName : "object-cover"} data-builder-field="image" data-builder-item={builderItem ?? undefined} fill preload={preload && index === 0} sizes={sizes} src={image.url} />
          : <Image alt={image.alt} className={imageClassName} data-builder-field="image" data-builder-item={builderItem ?? undefined} height={800} preload={preload && index === 0} sizes={sizes} src={image.url} width={1200} />}
      </div>)}
    </div>
    {count > 1 && cover ? <div aria-hidden="true" className="hero-images__dots">{images.map((_, index) => <span className={index === active ? "hero-images__dot hero-images__dot--active" : "hero-images__dot"} key={index} />)}</div> : null}
    {count > 1 && !cover ? <div className="hero-images__dots" {...(variant === "fill" ? pause : {})}>{images.map((_, index) => <button aria-current={index === active} aria-label={t("carousel.viewImage", { n: index + 1 })} className={index === active ? "hero-images__dot hero-images__dot--active" : "hero-images__dot"} key={index} onClick={() => setActive(index)} type="button" />)}</div> : null}
  </div>;
}
