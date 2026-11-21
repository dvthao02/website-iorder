"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { loginFailureEvent, loginSuccessEvent, type LoginSuccessDetail } from "@/lib/login-events";

import { requestEffect } from "./christmas-bus";
import { patterns } from "./christmas-patterns";

// Khung của cả trang đăng nhập mùa Giáng sinh và là bộ điều khiển các tương tác (mọi thứ ở đây đều là trang trí, không ảnh hưởng form):
// - Con trỏ ghi vào --px/--py (-1..1): các lớp cảnh dịch ngược chiều theo độ sâu, thẻ nghiêng 3D và vệt sáng loang theo.
//   Thiết bị cảm ứng không có con trỏ nên cảnh tự trôi nhẹ (sin/cos) cho có chiều sâu.
// - Bấm vào nền bắn pháo hoa; bấm người tuyết, hộp quà, ông già Noel thì chúng "phản ứng" (class is-poked + hiệu ứng).
// - LoginForm báo thành công/thất bại qua sự kiện: thất bại thì thẻ rung và đèn nháy đỏ; thành công thì xin thêm một nhịp để chiếu
//   pháo hoa, pháo giấy và thẻ bay lên trước khi chuyển trang.
// Mọi thứ tắt khi người dùng chọn "giảm chuyển động" (khi đó đăng nhập chuyển trang ngay, không chờ).

const celebrationMs = 1150;

export function ChristmasStage({ children }: { children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timers = new Set<number>();
    const cleanups: Array<() => void> = [];
    const later = (callback: () => void, delay: number) => {
      const id = window.setTimeout(() => { timers.delete(id); callback(); }, delay);
      timers.add(id);
    };
    const setParallax = (x: number, y: number) => {
      element.style.setProperty("--px", x.toFixed(3));
      element.style.setProperty("--py", y.toFixed(3));
    };

    if (!reducedMotion.matches) {
      if (finePointer.matches) {
        // Làm mượt bằng nội suy mỗi khung hình (không dùng transition CSS: transition bị khởi động lại ở mỗi lần chuột nhúc nhích nên giật).
        // Dừng vòng lặp khi đã tới đích nên lúc chuột đứng yên không tốn gì.
        let frame = 0;
        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;
        const follow = () => {
          currentX += (targetX - currentX) * 0.07;
          currentY += (targetY - currentY) * 0.07;
          setParallax(currentX, currentY);
          frame = Math.abs(targetX - currentX) > 0.002 || Math.abs(targetY - currentY) > 0.002 ? requestAnimationFrame(follow) : 0;
        };
        const move = (event: PointerEvent) => {
          targetX = (event.clientX / window.innerWidth - 0.5) * 2;
          targetY = (event.clientY / window.innerHeight - 0.5) * 2;
          if (!frame) frame = requestAnimationFrame(follow);
        };
        window.addEventListener("pointermove", move, { passive: true });
        cleanups.push(() => { window.removeEventListener("pointermove", move); if (frame) cancelAnimationFrame(frame); });
      } else {
        let frame = 0;
        let last = 0;
        const drift = (time: number) => {
          frame = requestAnimationFrame(drift);
          if (time - last < 33) return;
          last = time;
          setParallax(Math.sin(time / 9000) * 0.45, Math.cos(time / 12000) * 0.3);
        };
        frame = requestAnimationFrame(drift);
        cleanups.push(() => cancelAnimationFrame(frame));
      }

      // Bấm vào nền: pháo hoa. Bấm vào đồ vật có data-xmas: đồ vật phản ứng. Bấm trong thẻ đăng nhập thì bỏ qua.
      // Ông già Noel bay TRÊN thẻ đăng nhập (để không bị thẻ che khi màn hình hẹp/zoom to) nên không nhận chuột, kẻo chặn form khi bay ngang qua;
      // cú bấm vào nền mà trúng khung của ông thì tính là bấm ông (cú bấm trong thẻ vẫn thuộc về thẻ, đã loại ở trên).
      const santa = element.querySelector<HTMLElement>(".xmas__santa");
      const click = (event: MouseEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest(".xmas__card, .xmas__greeting")) return;
        const { clientX: x, clientY: y } = event;
        let poke = target.closest<HTMLElement>("[data-xmas]");
        if (!poke && santa) {
          const box = santa.getBoundingClientRect();
          if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) poke = santa;
        }
        if (!poke) {
          requestEffect({ type: "firework", x, y, pattern: patterns[Math.floor(Math.random() * patterns.length)] });
          return;
        }
        poke.classList.remove("is-poked");
        void poke.offsetWidth;
        poke.classList.add("is-poked");
        later(() => poke.classList.remove("is-poked"), 1700);
        if (poke.dataset.xmas === "gifts") {
          requestEffect({ type: "confetti", x, y, count: 54, angle: -Math.PI / 2, spread: 1.5 });
          requestEffect({ type: "sparkle", x, y });
        } else {
          requestEffect({ type: "sparkle", x, y });
        }
      };
      element.addEventListener("click", click);
      cleanups.push(() => element.removeEventListener("click", click));

      const success = (event: Event) => {
        (event as CustomEvent<LoginSuccessDetail>).detail.delayMs = celebrationMs;
        element.classList.add("xmas--success");
        requestEffect({ type: "celebrate" });
      };
      const failure = () => {
        element.classList.remove("xmas--alert");
        void element.offsetWidth;
        element.classList.add("xmas--alert");
        later(() => element.classList.remove("xmas--alert"), 900);
      };
      window.addEventListener(loginSuccessEvent, success);
      window.addEventListener(loginFailureEvent, failure);
      cleanups.push(() => {
        window.removeEventListener(loginSuccessEvent, success);
        window.removeEventListener(loginFailureEvent, failure);
      });
    }

    // Dấu hiệu "đã gắn xong các trình nghe" (sau hydrate): test và công cụ kiểm thử chờ dấu này trước khi tương tác.
    element.dataset.ready = "true";
    return () => {
      delete element.dataset.ready;
      cleanups.forEach((cleanup) => cleanup());
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return <div className="xmas" ref={stage}>{children}</div>;
}
