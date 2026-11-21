"use client";

import { useEffect, useRef } from "react";

/**
 * Thanh tiến độ đọc: vạch mảnh sát mép trên màn hình, dài theo phần bài đã cuộn qua (từ đầu bài tới cuối bài).
 * Chỉ trang trí (ẩn với trình đọc màn hình), cập nhật trực tiếp bằng transform nên không render lại; không hiện khi chưa cuộn tới bài.
 */
export function ReadingProgress({ target = "article" }: { target?: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = document.querySelector(target);
      if (!bar.current || !element) return;
      const rect = element.getBoundingClientRect();
      // Đọc xong khi cuối bài chạm khoảng 60% chiều cao màn hình (người đọc hiếm khi cuộn hẳn tới đáy).
      const total = Math.max(1, rect.height - window.innerHeight * 0.6);
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      bar.current.style.transform = `scaleX(${progress})`;
      bar.current.style.opacity = progress > 0 ? "1" : "0";
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); cancelAnimationFrame(frame); };
  }, [target]);
  return <div aria-hidden="true" className="reading-progress" ref={bar} />;
}
