"use client";

import { useEffect, useRef } from "react";

import { effectEvent, type EffectRequest } from "./christmas-bus";

type Flake = { x: number; y: number; radius: number; speed: number; sway: number; phase: number; alpha: number; depth: number; crystal: boolean; bokeh: boolean; angle: number; spin: number };

// Tuyết rơi vẽ bằng canvas, không thư viện. Ba tầng chiều sâu (xa: nhỏ, chậm, mờ; gần: to, nhanh, rõ), gió đổi chiều chậm,
// hoa tuyết lớn có hình tinh thể sáu cánh, vài hạt mờ rất lớn (bokeh) tạo chiều sâu trường ảnh. Đăng nhập thành công thì nổi cơn bão tuyết (sự kiện "flurry").
// Tuyết rải theo con trỏ nằm ở christmas-effects.tsx (canvas phía trên thẻ). Vẽ bằng sprite dựng sẵn nên rẻ; dừng khi tab
// bị ẩn; với "giảm chuyển động" chỉ vẽ một khung tĩnh. Mật độ theo diện tích màn hình (điện thoại ít hạt hơn).

function dotSprite() {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const context = sprite.getContext("2d");
  if (!context) return sprite;
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.4, "rgba(255,255,255,0.85)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  return sprite;
}

function bokehSprite() {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const context = sprite.getContext("2d");
  if (!context) return sprite;
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, "rgba(255,255,255,0.55)");
  glow.addColorStop(0.7, "rgba(210,225,255,0.5)");
  glow.addColorStop(0.92, "rgba(255,255,255,0.75)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  return sprite;
}

function crystalSprite() {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const context = sprite.getContext("2d");
  if (!context) return sprite;
  context.translate(32, 32);
  context.strokeStyle = "rgba(255,255,255,0.95)";
  context.lineCap = "round";
  context.lineWidth = 3;
  for (let arm = 0; arm < 6; arm += 1) {
    context.rotate(Math.PI / 3);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, -26);
    context.moveTo(0, -15);
    context.lineTo(-7, -22);
    context.moveTo(0, -15);
    context.lineTo(7, -22);
    context.stroke();
  }
  return sprite;
}

export function ChristmasSnow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const surface = canvas;
    const paint = context;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dot = dotSprite();
    const bokeh = bokehSprite();
    const crystal = crystalSprite();
    const flakes: Flake[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = 0;
    let boost = 0;

    const spawn = (anywhere: boolean, forceBokeh = false): Flake => {
      const depth = forceBokeh ? 1 : Math.random();
      const radius = forceBokeh ? 9 + Math.random() * 9 : 1.1 + depth * depth * 4.6;
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : -radius * 2,
        radius,
        speed: forceBokeh ? 70 + Math.random() * 40 : 16 + depth * 58,
        sway: 6 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2,
        alpha: forceBokeh ? 0.16 + Math.random() * 0.1 : 0.35 + depth * 0.55,
        depth,
        crystal: !forceBokeh && radius > 3.5 && Math.random() < 0.55,
        bokeh: forceBokeh,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.2,
      };
    };

    const draw = () => {
      paint.clearRect(0, 0, width, height);
      for (const flake of flakes) {
        paint.globalAlpha = flake.alpha;
        if (flake.bokeh) {
          const size = flake.radius * 2;
          paint.drawImage(bokeh, flake.x - size / 2, flake.y - size / 2, size, size);
        } else if (flake.crystal) {
          paint.save();
          paint.translate(flake.x, flake.y);
          paint.rotate(flake.angle);
          paint.drawImage(crystal, -flake.radius * 1.5, -flake.radius * 1.5, flake.radius * 3, flake.radius * 3);
          paint.restore();
        } else {
          const size = flake.radius * 2.4;
          paint.drawImage(dot, flake.x - size / 2, flake.y - size / 2, size, size);
        }
      }
      paint.globalAlpha = 1;
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = surface.clientWidth;
      height = surface.clientHeight;
      surface.width = Math.round(width * ratio);
      surface.height = Math.round(height * ratio);
      paint.setTransform(ratio, 0, 0, ratio, 0, 0);
      const bokehCount = width < 640 ? 3 : 7;
      const target = Math.round(Math.min(170, Math.max(48, (width * height) / 9500)));
      const wanted = target + bokehCount;
      while (flakes.length < wanted) flakes.push(spawn(true, flakes.length >= target));
      flakes.length = wanted;
      flakes.forEach((flake, index) => { flake.bokeh = index >= target; });
      draw();
    };

    const tick = (time: number) => {
      const delta = Math.min((time - previous) / 1000, 0.05);
      previous = time;
      boost = Math.max(0, boost - delta / 1.8);
      const wind = Math.sin(time / 5200) * 14 + 6 + boost * 140;
      for (const flake of flakes) {
        flake.y += flake.speed * (1 + boost * 3.2) * delta;
        flake.x += (wind * (0.35 + flake.depth) + Math.cos(flake.phase + time / 900) * flake.sway * 0.45) * delta;
        flake.angle += flake.spin * delta * (1 + boost * 4);
        if (flake.y - flake.radius > height || flake.x > width + 30 || flake.x < -30) {
          const reborn = spawn(false, flake.bokeh);
          Object.assign(flake, reborn);
          if (flake.x > width) flake.x = Math.random() * width;
        }
      }
      draw();
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    const start = () => {
      if (frame || reducedMotion.matches || document.hidden) return;
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (reducedMotion.matches || document.hidden) stop();
      else start();
    };

    const flurry = (event: Event) => {
      if ((event as CustomEvent<EffectRequest>).detail?.type === "flurry" && !reducedMotion.matches) boost = 1;
    };

    resize();
    start();
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);
    window.addEventListener(effectEvent, flurry);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reducedMotion.removeEventListener("change", sync);
      window.removeEventListener(effectEvent, flurry);
    };
  }, []);

  return <canvas aria-hidden="true" className="xmas__snow" ref={canvasRef} />;
}
