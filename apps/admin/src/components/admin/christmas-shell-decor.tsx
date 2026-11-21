"use client";

import { Snowflake } from "lucide-react";
import { useEffect, useRef } from "react";

import { useCmsColorTheme } from "./admin-theme-settings";
import { ChristmasBell } from "./christmas-bell";

// Trang trí khung CMS cho theme "Giáng sinh" (chọn ở Giao diện CMS). Chỉ là hình, aria-hidden và không bắt chuột; đèn chỉ chớp rất nhẹ (độ mờ 100% ↔ 35%, ~4 giây), không bật tắt dứt khoát.
// - ChristmasTopbarDecor: dây kim tuyến (đèn chớp nhẹ xen kẽ) vắt dọc mép trên thanh trên, vài cây thông nhỏ phủ tuyết, người tuyết và hộp quà đứng trên dải tuyết, vài chiếc chuông treo đung đưa và vài bông tuyết trôi rất chậm, ở khoảng trống
//   giữa ô tìm kiếm và nút "Xem website" (CSS container query tự bớt cây khi chỗ trống hẹp, ẩn hẳn khi quá hẹp).
// - Tuyết rơi nhẹ chỉ ở khung trên: canvas SnowLayer nằm trong thanh trên (phía sau ô nhập và nút) và trong khu logo bên trái, không phủ màn hình làm việc.

// Vài bóng đèn nhỏ trên mỗi cây thông, chớp nhẹ xen kẽ hai nhóm (CSS .admin-festive__bulb).
const pineLights: Array<[number, number]> = [[12, 6], [10.2, 10.6], [14.2, 10], [8.4, 16], [12.4, 17.2], [16, 16], [5.6, 25], [10, 23.4], [14.4, 24.4], [18.6, 25.6]];

function Pine({ level }: { level: number }) {
  return <svg aria-hidden="true" className={`admin-festive__pine admin-festive__pine--${level}`} focusable="false" viewBox="0 0 24 34">
    <rect fill="#6b4a2a" height="7" rx="1" width="4" x="10" y="27" />
    <path d="M12 14 L22 29 L2 29 Z" fill="#17724a" />
    <path d="M12 7 L20 21 L4 21 Z" fill="#1c8052" />
    <path d="M12 1 L18 12 L6 12 Z" fill="#23915d" />
    <path d="M12 1 L14.4 5.4 Q12 4.4 9.6 5.4 Z" fill="#f4f8ff" />
    <path d="M12 7 L15 12 Q12 10.8 9 12 Z" fill="#f4f8ff" />
    <path d="M12 14 L16 20.5 Q12 19 8 20.5 Z" fill="#f4f8ff" />
    {pineLights.map(([cx, cy], index) => <g className={`admin-festive__bulb admin-festive__bulb--${index % 2}`} key={`${cx}-${cy}`}>
      <circle cx={cx} cy={cy} fill="#ffd27a" opacity="0.4" r="2.3" />
      <circle cx={cx} cy={cy} fill="#fff3c4" r="0.95" />
    </g>)}
  </svg>;
}

// Người tuyết nhỏ: ba quả cầu tuyết, khăn đỏ, mũ len xanh, mũi cà rốt, tay cành cây. Viền xanh rất mảnh để vẫn thấy trên nền kem.
function Snowman() {
  return <svg aria-hidden="true" className="admin-festive__snowman" focusable="false" viewBox="0 0 20 30">
    <path d="M1.5 13.2 L4.6 14.4 M18.5 13.2 L15.4 14.4" fill="none" stroke="#6b4a2a" strokeLinecap="round" strokeWidth="0.9" />
    <circle cx="10" cy="23.4" fill="#fbfdff" r="6.4" stroke="#b7cde8" strokeWidth="0.6" />
    <circle cx="10" cy="14.6" fill="#fbfdff" r="4.8" stroke="#b7cde8" strokeWidth="0.6" />
    <circle cx="10" cy="7.6" fill="#fbfdff" r="3.7" stroke="#b7cde8" strokeWidth="0.6" />
    <path d="M6.2 6.6 Q6.4 2.2 10 2.2 Q13.6 2.2 13.8 6.6 Z" fill="#1c8052" />
    <rect fill="#c62833" height="1.5" rx="0.6" width="8.6" x="5.7" y="5.6" />
    <circle cx="10" cy="1.8" fill="#f4f8ff" r="1.1" />
    <circle cx="8.6" cy="7.4" fill="#27324a" r="0.5" />
    <circle cx="11.4" cy="7.4" fill="#27324a" r="0.5" />
    <path d="M10 8.2 L12.8 9 L10 9.6 Z" fill="#f08a24" />
    <path d="M6.6 10.8 Q10 12.6 13.4 10.8 L13.2 12.4 Q10 14 6.8 12.4 Z" fill="#c62833" />
    <path d="M12.2 12.2 L13 15.8 L11.4 15.4 Z" fill="#a31d28" />
    <circle cx="10" cy="16.4" fill="#27324a" r="0.5" />
    <circle cx="10" cy="19.6" fill="#27324a" r="0.55" />
    <circle cx="10" cy="23.2" fill="#27324a" r="0.6" />
  </svg>;
}

// Hộp quà nhỏ: thân, nắp, dây ruy băng dọc/ngang và nơ; ba bộ màu (đỏ–vàng, xanh–đỏ, vàng–xanh).
const giftTones = { red: ["#c62833", "#a31d28", "#f1d58a"], green: ["#1c8052", "#17663f", "#e0434f"], gold: ["#e8b84a", "#c99a2e", "#1c8052"] } as const;
function Gift({ tone }: { tone: keyof typeof giftTones }) {
  const [body, lid, ribbon] = giftTones[tone];
  return <svg aria-hidden="true" className="admin-festive__gift" focusable="false" viewBox="0 0 18 18">
    <rect fill={body} height="8.6" rx="0.8" width="13.6" x="2.2" y="8.8" />
    <rect fill={lid} height="3.4" rx="0.8" width="15.6" x="1.2" y="5.8" />
    <rect fill={ribbon} height="11.8" width="2.2" x="7.9" y="5.8" />
    <path d="M9 5.8 C6.2 5.6 4.8 2.2 6.8 1.8 C8.4 1.5 9 4 9 5.8 Z M9 5.8 C11.8 5.6 13.2 2.2 11.2 1.8 C9.6 1.5 9 4 9 5.8 Z" fill={ribbon} />
    <circle cx="9" cy="5.6" fill={lid} r="0.9" />
  </svg>;
}

// Khung cảnh trên dải tuyết, từ trái sang phải. Cây thông và người tuyết xếp trước để khi chỗ trống hẹp (container query bớt từ cuối) vẫn còn cảnh chính.
const scene = [
  { kind: "pine", level: 2 }, { kind: "snowman" }, { kind: "pine", level: 4 }, { kind: "gift", tone: "red" }, { kind: "pine", level: 1 },
  { kind: "gift", tone: "green" }, { kind: "pine", level: 3 }, { kind: "snowman" }, { kind: "gift", tone: "gold" }, { kind: "pine", level: 5 },
] as const;

// Khu logo bên trái: tuyết rơi nhẹ như ở thanh trên (canvas nằm trong khu logo, phía sau logo), cùng người tuyết và hai hộp quà đứng trên dải tuyết
// ở khoảng trống bên phải chữ "CMS" (quà và người tuyết ẩn khi thanh bên thu gọn).
export function ChristmasBrandDecor() {
  if (useCmsColorTheme() !== "christmas") return null;
  return <>
    <SnowLayer />
    <span aria-hidden="true" className="admin-brand__festive">
      <Gift tone="green" />
      <Snowman />
      <Gift tone="red" />
    </span>
  </>;
}

export function ChristmasTopbarDecor() {
  if (useCmsColorTheme() !== "christmas") return null;
  return <>
    <div aria-hidden="true" className="xmas-tinsel xmas-tinsel--cms" />
    <SnowLayer />
    <div aria-hidden="true" className="admin-topbar__festive">
      <div className="admin-festive__trees">
        {scene.map((item, index) => item.kind === "pine" ? <Pine key={index} level={item.level} /> : item.kind === "snowman" ? <Snowman key={index} /> : <Gift key={index} tone={item.tone} />)}
      </div>
      {[1, 2, 3, 4].map((index) => <ChristmasBell className={`xmas-bell admin-festive__bell admin-festive__bell--${index}`} key={index} />)}
      <Snowflake className="admin-festive__flake admin-festive__flake--1" size={13} strokeWidth={1.6} />
      <Snowflake className="admin-festive__flake admin-festive__flake--2" size={10} strokeWidth={1.8} />
      <Snowflake className="admin-festive__flake admin-festive__flake--3" size={15} strokeWidth={1.5} />
      <Snowflake className="admin-festive__flake admin-festive__flake--4" size={11} strokeWidth={1.7} />
    </div>
  </>;
}

type Flake = { x: number; y: number; radius: number; speed: number; sway: number; phase: number; alpha: number; crystal: boolean; angle: number; spin: number };

// Hạt tuyết có lõi trắng và quầng xanh nhạt để vẫn thấy được trên nền kem/trắng của CMS.
function dotSprite() {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 32;
  const context = sprite.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.38, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.62, "rgba(120,165,245,0.8)");
    gradient.addColorStop(1, "rgba(140,178,250,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
  }
  return sprite;
}

function crystalSprite() {
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
  arms(6.5, "rgba(110,155,240,0.75)");
  arms(2.6, "#ffffff");
  return sprite;
}

function SnowLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const surface = canvas;
    const paint = context;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Giảm chuyển động: không có tuyết (vài chấm đứng yên trên màn làm việc chỉ giống bụi).
    if (reducedMotion.matches) return;
    const dot = dotSprite();
    const crystal = crystalSprite();
    const flakes: Flake[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = 0;

    const spawn = (anywhere: boolean): Flake => {
      const radius = 1.8 + Math.random() * 2.6;
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : -radius * 3,
        radius,
        speed: 14 + radius * 5 + Math.random() * 8,
        sway: 6 + Math.random() * 12,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.7 + Math.random() * 0.3,
        crystal: radius > 2.8 && Math.random() < 0.65,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.8,
      };
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = surface.clientWidth;
      height = surface.clientHeight;
      surface.width = Math.round(width * ratio);
      surface.height = Math.round(height * ratio);
      paint.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Thanh trên chỉ cao ~56px: số hạt theo bề ngang (khoảng một hạt mỗi 100px), ít hạt để không rối mắt.
      const target = Math.min(Math.max(Math.round(width / 100), 6), 18);
      while (flakes.length < target) flakes.push(spawn(true));
      flakes.length = target;
    };

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      // 30 khung/giây là đủ cho tuyết rơi chậm và nhẹ máy hơn.
      if (time - previous < 32) return;
      const delta = Math.min((time - previous) / 1000, 0.1);
      previous = time;
      paint.clearRect(0, 0, width, height);
      const wind = Math.sin(time / 6000) * 8;
      for (const flake of flakes) {
        flake.y += flake.speed * delta;
        flake.x += (wind + Math.cos(flake.phase + time / 1100) * flake.sway * 0.5) * delta;
        flake.angle += flake.spin * delta;
        if (flake.y - flake.radius > height || flake.x > width + 20 || flake.x < -20) Object.assign(flake, spawn(false));
        paint.globalAlpha = flake.alpha;
        if (flake.crystal) {
          paint.save();
          paint.translate(flake.x, flake.y);
          paint.rotate(flake.angle);
          paint.drawImage(crystal, -flake.radius * 1.6, -flake.radius * 1.6, flake.radius * 3.2, flake.radius * 3.2);
          paint.restore();
        } else {
          const size = flake.radius * 2.8;
          paint.drawImage(dot, flake.x - size / 2, flake.y - size / 2, size, size);
        }
      }
      paint.globalAlpha = 1;
    };

    const start = () => {
      if (frame || document.hidden) return;
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    const sync = () => { if (document.hidden) stop(); else start(); };

    resize();
    start();
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return <canvas aria-hidden="true" className="admin-festive-snow" data-cms-snow="" ref={canvasRef} />;
}

