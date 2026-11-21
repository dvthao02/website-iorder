"use client";

import { useEffect, useRef } from "react";

import { effectEvent, requestEffect, type EffectRequest } from "./christmas-bus";
import { burstVelocities, patternTraits, patterns, type Pattern } from "./christmas-patterns";

// Pháo hoa, pháo giấy, tia lấp lánh và tuyết rải theo con trỏ trên một canvas phủ cả trang (trên thẻ đăng nhập, không bắt chuột).
// Vòng vẽ chỉ chạy khi còn hạt; hết hạt thì tự dừng nên lúc rảnh không tốn CPU. Hạt phát sáng cộng màu (lighter) và có đuôi
// kéo theo; pháo giấy là hình chữ nhật xoay, lật như đang bay. Không dùng khi người dùng chọn "giảm chuyển động".

const palette = ["#ff5a67", "#ffd166", "#5eead4", "#7cc4ff", "#ffffff", "#b794ff"] as const;
const maxParticles = 1400;

type Particle = {
  kind: "spark" | "confetti" | "snow";
  x: number; y: number; vx: number; vy: number;
  tailX: number; tailY: number;
  age: number; ttl: number; size: number; color: number;
  gravity: number; drag: number; angle: number; spin: number; flutter: number;
  phase: number; crystal: boolean;
};
type Rocket = { fromX: number; fromY: number; toX: number; toY: number; age: number; duration: number; pattern: Pattern; scale: number };

function glowSprite(color: string) {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 32;
  const context = sprite.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.25, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
  }
  return sprite;
}

// Tuyết con trỏ: lõi trắng, quầng xanh nhạt (để thấy được cả trên nền thẻ trắng).
function snowDotSprite() {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 32;
  const context = sprite.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.38, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.62, "rgba(140,178,250,0.55)");
    gradient.addColorStop(1, "rgba(140,178,250,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
  }
  return sprite;
}

function snowCrystalSprite() {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const context = sprite.getContext("2d");
  if (!context) return sprite;
  const arms = (width: number, color: string) => {
    context.save();
    context.translate(32, 32);
    context.strokeStyle = color;
    context.lineCap = "round";
    context.lineWidth = width;
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
    context.restore();
  };
  arms(6, "rgba(120,160,235,0.55)");
  arms(2.6, "#ffffff");
  return sprite;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function ChristmasEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const surface = canvas;
    const paint = context;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sprites = palette.map(glowSprite);
    const snowDot = snowDotSprite();
    const snowCrystal = snowCrystalSprite();
    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    const timers = new Set<number>();
    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = 0;
    let idleTimer = 0;
    // Tuyết rải theo con trỏ: vị trí, thời điểm và quãng đường chưa đủ một bước ở lần di chuyển trước.
    let trailX = 0;
    let trailY = 0;
    let trailTime = 0;
    let trailCarry = 0;

    const later = (callback: () => void, delay: number) => {
      const id = window.setTimeout(() => { timers.delete(id); callback(); }, delay);
      timers.add(id);
    };
    const local = (x: number, y: number) => {
      const box = surface.getBoundingClientRect();
      return { x: x - box.left, y: y - box.top };
    };

    const spark = (x: number, y: number, vx: number, vy: number, color: number, ttl: number, size: number, gravity: number, drag: number) => {
      if (particles.length < maxParticles) particles.push({ kind: "spark", x, y, vx, vy, tailX: x, tailY: y, age: 0, ttl, size, color, gravity, drag, angle: 0, spin: 0, flutter: 0, phase: 0, crystal: false });
    };

    const burst = (x: number, y: number, pattern: Pattern, scale: number) => {
      const traits = patternTraits[pattern];
      const tint = Math.floor(Math.random() * palette.length);
      const velocities = burstVelocities(pattern, Math.random);
      const green = pattern === "tree";
      velocities.forEach((velocity, index) => {
        // Cây thông nổ màu xanh và vàng; kiểu khác chọn một màu chủ đạo pha thêm màu kề.
        const color = green ? (index % 7 === 0 ? 1 : 2) : (index % 5 === 0 ? (tint + 1) % palette.length : tint);
        const ttl = traits.life[0] + Math.random() * (traits.life[1] - traits.life[0]);
        spark(x, y, velocity.x * scale, velocity.y * scale, color, ttl, 2.1 + Math.random() * 1.3, traits.gravity, traits.drag);
      });
      // Đốm sáng ở tâm nổ.
      for (let index = 0; index < 8; index += 1) spark(x, y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 4, 0.35, 4.5, 0, 0.05);
    };

    const confetti = (x: number, y: number, count: number, angle: number, spread: number) => {
      for (let index = 0; index < count && particles.length < maxParticles; index += 1) {
        const direction = angle + (Math.random() - 0.5) * spread;
        const power = 260 + Math.random() * 420;
        particles.push({
          kind: "confetti", x, y, vx: Math.cos(direction) * power, vy: Math.sin(direction) * power, tailX: x, tailY: y,
          age: 0, ttl: 2.2 + Math.random() * 1.4, size: 5 + Math.random() * 6, color: Math.floor(Math.random() * 4),
          gravity: 420, drag: 0.28, angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 14, flutter: 6 + Math.random() * 8, phase: 0, crystal: false,
        });
      }
    };

    const sparkle = (x: number, y: number) => {
      for (let index = 0; index < 12; index += 1) {
        const direction = Math.random() * Math.PI * 2;
        const power = 40 + Math.random() * 110;
        spark(x, y, Math.cos(direction) * power, Math.sin(direction) * power, 1, 0.45 + Math.random() * 0.3, 2.2, 60, 0.06);
      }
    };

    const snowFlake = (x: number, y: number, vx: number, vy: number) => {
      if (particles.length >= maxParticles) return;
      const crystal = Math.random() < 0.28;
      particles.push({
        kind: "snow", x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
        vx: vx * 0.06 + (Math.random() - 0.5) * 26, vy: 8 + Math.random() * 26 + Math.max(vy, 0) * 0.04, tailX: x, tailY: y,
        age: 0, ttl: 2.4 + Math.random() * 1.8, size: crystal ? 7 + Math.random() * 5 : 3 + Math.random() * 3.2, color: 4,
        gravity: 42, drag: 0.5, angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 2.2, flutter: 2 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2, crystal,
      });
    };

    // Kéo chuột tới đâu tuyết rơi ra từ đó: rải một hạt mỗi ~11px dọc đường đi (nội suy nên kéo nhanh vẫn thành một vệt liền),
    // mỗi hạt thừa một chút vận tốc của chuột rồi rơi xuống, đung đưa và mờ dần.
    const trail = (event: PointerEvent) => {
      if (reducedMotion.matches || document.hidden) return;
      const point = local(event.clientX, event.clientY);
      const now = performance.now();
      const elapsed = (now - trailTime) / 1000;
      const continuing = trailTime > 0 && elapsed < 0.16;
      const dx = point.x - trailX;
      const dy = point.y - trailY;
      trailX = point.x;
      trailY = point.y;
      trailTime = now;
      if (!continuing) { trailCarry = 0; return; }
      const distance = Math.hypot(dx, dy);
      if (distance < 0.5) return;
      const spacing = 11;
      const vx = dx / Math.max(elapsed, 0.008);
      const vy = dy / Math.max(elapsed, 0.008);
      let emitted = 0;
      for (let along = spacing - trailCarry; along <= distance && emitted < 14; along += spacing) {
        const t = along / distance;
        snowFlake(point.x - dx * (1 - t), point.y - dy * (1 - t), vx, vy);
        emitted += 1;
      }
      trailCarry = (trailCarry + distance) % spacing;
      if (emitted) start();
    };

    const rocket = (toX: number, toY: number, pattern: Pattern, scale: number) => {
      rockets.push({ fromX: toX + (Math.random() - 0.5) * 120, fromY: height + 12, toX, toY, age: 0, duration: 0.7 + Math.random() * 0.25, pattern, scale });
    };

    const draw = () => {
      paint.clearRect(0, 0, width, height);
      paint.globalCompositeOperation = "lighter";
      for (const particle of particles) {
        if (particle.kind !== "spark") continue;
        const life = 1 - particle.age / particle.ttl;
        const alpha = Math.min(1, life * 1.6);
        paint.globalAlpha = alpha * 0.55;
        paint.strokeStyle = palette[particle.color];
        paint.lineWidth = particle.size * 0.8;
        paint.lineCap = "round";
        paint.beginPath();
        paint.moveTo(particle.tailX, particle.tailY);
        paint.lineTo(particle.x, particle.y);
        paint.stroke();
        paint.globalAlpha = alpha;
        const size = particle.size * (2.6 + life * 1.2);
        paint.drawImage(sprites[particle.color], particle.x - size / 2, particle.y - size / 2, size, size);
      }
      paint.globalCompositeOperation = "source-over";
      for (const particle of particles) {
        if (particle.kind === "snow") {
          const life = 1 - particle.age / particle.ttl;
          paint.globalAlpha = Math.min(1, life * 2.4, 0.25 + particle.age * 8) * 0.95;
          const size = particle.size * 2.3;
          if (particle.crystal) {
            paint.save();
            paint.translate(particle.x, particle.y);
            paint.rotate(particle.angle);
            paint.drawImage(snowCrystal, -size / 2, -size / 2, size, size);
            paint.restore();
          } else {
            paint.drawImage(snowDot, particle.x - size / 2, particle.y - size / 2, size, size);
          }
          continue;
        }
        if (particle.kind !== "confetti") continue;
        paint.globalAlpha = Math.min(1, (particle.ttl - particle.age) * 2);
        paint.save();
        paint.translate(particle.x, particle.y);
        paint.rotate(particle.angle);
        paint.scale(1, Math.cos(particle.age * particle.flutter));
        paint.fillStyle = palette[particle.color];
        paint.fillRect(-particle.size / 2, -particle.size * 0.22, particle.size, particle.size * 0.44);
        paint.restore();
      }
      paint.globalAlpha = 1;
    };

    const tick = (time: number) => {
      const delta = Math.min((time - previous) / 1000, 0.05);
      previous = time;
      for (let index = rockets.length - 1; index >= 0; index -= 1) {
        const item = rockets[index];
        item.age += delta;
        const progress = Math.min(item.age / item.duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const x = item.fromX + (item.toX - item.fromX) * eased;
        const y = item.fromY + (item.toY - item.fromY) * eased;
        spark(x, y, (Math.random() - 0.5) * 30, 40 + Math.random() * 40, 1, 0.4, 2, 0, 0.1);
        if (progress >= 1) {
          burst(item.toX, item.toY, item.pattern, item.scale);
          rockets.splice(index, 1);
        }
      }
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.age += delta;
        if (particle.age >= particle.ttl || particle.y > height + 40) { particles.splice(index, 1); continue; }
        if (particle.kind === "snow") {
          particle.vx *= Math.pow(particle.drag, delta);
          particle.vy = Math.min(particle.vy + particle.gravity * delta, 95);
          particle.x += (particle.vx + Math.sin(particle.age * particle.flutter + particle.phase) * 16) * delta;
          particle.y += particle.vy * delta;
          particle.angle += particle.spin * delta;
          continue;
        }
        const drag = Math.pow(particle.drag, delta);
        particle.vx *= drag;
        particle.vy = particle.vy * drag + particle.gravity * delta;
        if (particle.kind === "confetti") particle.vy = Math.min(particle.vy, 170);
        particle.tailX += (particle.x - particle.tailX) * 0.35;
        particle.tailY += (particle.y - particle.tailY) * 0.35;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.angle += particle.spin * delta;
      }
      draw();
      if (!particles.length && !rockets.length) {
        paint.clearRect(0, 0, width, height);
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame || document.hidden) return;
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = surface.clientWidth;
      height = surface.clientHeight;
      surface.width = Math.round(width * ratio);
      surface.height = Math.round(height * ratio);
      paint.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    // Chúc mừng đăng nhập thành công: pháo giấy từ hai góc đáy thẻ, bốn quả pháo hoa nổ so le trên bầu trời.
    const celebrate = () => {
      const card = document.querySelector(".xmas__card")?.getBoundingClientRect();
      if (card) {
        const left = local(card.left + 24, card.bottom - 10);
        const right = local(card.right - 24, card.bottom - 10);
        confetti(left.x, left.y, 70, -Math.PI / 2 - 0.45, 0.9);
        confetti(right.x, right.y, 70, -Math.PI / 2 + 0.45, 0.9);
      }
      const shots: Array<[number, number, number, Pattern, number]> = [[0, 0.28, 0.3, "star", 1], [150, 0.72, 0.24, "tree", 1], [320, 0.5, 0.15, "peony", 1.15], [480, 0.16, 0.4, "willow", 0.9]];
      for (const [delay, fx, fy, pattern, scale] of shots) later(() => { rocket(width * fx, height * fy, pattern, scale); start(); }, delay);
      requestEffect({ type: "flurry" });
    };

    const handle = (event: Event) => {
      if (reducedMotion.matches) return;
      const request = (event as CustomEvent<EffectRequest>).detail;
      switch (request.type) {
        case "firework": { const point = local(request.x, request.y); burst(point.x, point.y, request.pattern ?? pick(patterns), request.scale ?? 1); break; }
        case "rocket": { const point = local(request.x, request.y); rocket(point.x, point.y, request.pattern ?? pick(patterns), request.scale ?? 1); break; }
        case "confetti": { const point = local(request.x, request.y); confetti(point.x, point.y, request.count ?? 50, request.angle ?? -Math.PI / 2, request.spread ?? 1.2); break; }
        case "sparkle": { const point = local(request.x, request.y); sparkle(point.x, point.y); break; }
        case "celebrate": celebrate(); break;
        default: return;
      }
      start();
    };

    // Thỉnh thoảng một quả pháo hoa nhỏ nổ xa trên trời cho cảnh có sức sống; tạm nghỉ khi đang gửi đăng nhập hoặc tab bị ẩn.
    const scheduleIdle = () => {
      idleTimer = window.setTimeout(() => {
        const busy = document.querySelector(".xmas__card button[type=\"submit\"]:disabled");
        if (!document.hidden && !reducedMotion.matches && !busy) {
          rocket(width * (0.1 + Math.random() * 0.8), height * (0.1 + Math.random() * 0.25), pick(["peony", "ring", "willow"] as const), 0.7);
          start();
        }
        scheduleIdle();
      }, 8000 + Math.random() * 7000);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    window.addEventListener(effectEvent, handle);
    window.addEventListener("pointermove", trail, { passive: true });
    const visibility = () => { if (!document.hidden && (particles.length || rockets.length)) start(); };
    document.addEventListener("visibilitychange", visibility);
    scheduleIdle();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(idleTimer);
      timers.forEach((id) => window.clearTimeout(id));
      observer.disconnect();
      window.removeEventListener(effectEvent, handle);
      window.removeEventListener("pointermove", trail);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return <canvas aria-hidden="true" className="xmas__fx" ref={canvasRef} />;
}
