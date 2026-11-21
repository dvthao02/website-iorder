"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const center = 170;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

type Spoke = { angle: number; anchor: { x: number; y: number } | null };

// Góc các chấm chia đều: thẻ trên cùng (nếu có) ở đỉnh; thẻ hai bên chia đều trên cung đối xứng qua trục dọc (từ trên xuống dưới).
function evenAngles(sides: Array<"top" | "left" | "right">) {
  const hasTop = sides.includes("top");
  const left = sides.filter(side => side === "left").length;
  const right = sides.filter(side => side === "right").length;
  // Nhiều thẻ mỗi bên thì mở rộng cung để chấm gần ngang với thẻ hơn (đường nối ngắn); có thẻ trên cùng thì chừa chỗ cho chấm ở đỉnh.
  const half = Math.min(hasTop ? 62 : 80, 40 + 12 * Math.max(left, right));
  const spread = (count: number, index: number) => count === 1 ? 0 : -half + (index * 2 * half) / (count - 1);
  let leftIndex = 0;
  let rightIndex = 0;
  return sides.map(side => {
    if (side === "top") return radians(-90);
    // Cột phải: góc a (độ, 0 = sang phải); cột trái là ảnh phản chiếu 180 − a.
    if (side === "right") return radians(spread(right, rightIndex++));
    return radians(180 - spread(left, leftIndex++));
  });
}

// Vòng tròn thương hiệu của "Hệ sinh thái quỹ đạo". Mỗi thẻ có một chấm trên vòng, các chấm chia đều và cân hai bên; từ chấm có đường
// mảnh nối tới điểm gần nhất trên cạnh trong của đúng thẻ đó (đo vị trí thật của thẻ nên khớp dù thẻ ở hàng nào hay nội dung cao thấp thế nào).
// Màn hẹp (các thẻ xếp dưới vòng tròn) thì rải đều quanh vòng, không có đường nối. Chỉ vẽ sau khi đo xong để không nhảy vị trí.
export function OrbitHub({ count, children }: { count: number; children: ReactNode }) {
  const hub = useRef<HTMLDivElement>(null);
  const [spokes, setSpokes] = useState<Spoke[] | null>(null);

  useEffect(() => {
    const element = hub.current;
    const orbit = element?.closest<HTMLElement>(".orbit");
    if (!element || !orbit) return;
    const measure = () => {
      const total = Math.max(count, 3);
      const around = Array.from({ length: total }, (_, index) => ({ angle: (index / total) * Math.PI * 2 - Math.PI / 2, anchor: null }));
      if (!window.matchMedia("(min-width: 1024px)").matches) { setSpokes(around); return; }
      const items = Array.from(orbit.querySelectorAll<HTMLElement>(".orbit__item"));
      if (!items.length) { setSpokes(around); return; }
      const sides = items.map(item => item.classList.contains("orbit__item--top") ? "top" as const : item.classList.contains("orbit__item--left") ? "left" as const : "right" as const);
      const angles = evenAngles(sides);
      const box = element.getBoundingClientRect();
      const scale = 340 / box.width;
      const gap = 10;
      const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
      setSpokes(items.map((item, index) => {
        const rect = item.getBoundingClientRect();
        const side = sides[index];
        // Chấm trên vòng (tọa độ màn hình), rồi điểm gần nhất của cạnh trong của thẻ: đường nối ngắn nhất, thường nằm ngang.
        const dotX = box.left + (center + Math.cos(angles[index]) * 160) / scale;
        const dotY = box.top + (center + Math.sin(angles[index]) * 160) / scale;
        const px = side === "top" ? clamp(dotX, rect.left + 12, rect.right - 12) : side === "left" ? rect.right + gap : rect.left - gap;
        const py = side === "top" ? rect.bottom + gap : clamp(dotY, rect.top + 8, rect.bottom - 8);
        return { angle: angles[index], anchor: { x: (px - box.left) * scale, y: (py - box.top) * scale } };
      }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(orbit);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [count]);

  return <div aria-hidden="true" className="orbit__hub" ref={hub}>
    <svg viewBox="0 0 340 340">
      <defs><radialGradient cx="50%" cy="50%" id="orbit-hub-glow" r="50%"><stop className="orbit__glow-from" offset="0%" /><stop className="orbit__glow-to" offset="100%" /></radialGradient></defs>
      <circle className="orbit__ring" cx={center} cy={center} r="160" />
      <circle className="orbit__disc" cx={center} cy={center} r="118" />
      {(spokes ?? []).map((spoke, index) => {
        const point = (radius: number) => ({ x: center + Math.cos(spoke.angle) * radius, y: center + Math.sin(spoke.angle) * radius });
        const inner = point(122);
        const outer = point(160);
        return <g key={index}>
          {spoke.anchor ? <line className="orbit__link" x1={outer.x} x2={spoke.anchor.x} y1={outer.y} y2={spoke.anchor.y} /> : null}
          <line className="orbit__spoke" x1={inner.x} x2={outer.x} y1={inner.y} y2={outer.y} />
          <circle className="orbit__dot" cx={outer.x} cy={outer.y} r="4.5" />
        </g>;
      })}
    </svg>
    <div className="orbit__brand">{children}</div>
  </div>;
}
