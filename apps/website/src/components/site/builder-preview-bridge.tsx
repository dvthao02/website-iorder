"use client";

import { useEffect } from "react";

import { parseHighlightMessage } from "@/lib/builder-preview-message";

/** Chỉ được gắn trong iframe có token preview hợp lệ; tương tác không được gửi form hay mở liên kết thật. */
export function BuilderPreviewBridge({ parentOrigin }: { parentOrigin: string }) {
  useEffect(() => {
    const editor: Window = window.opener ?? window.parent;
    let active: HTMLElement | null = null;
    const timers: number[] = [];
    const restoreTimers: number[] = [];
    let restoring = false;
    // Cuộn tức thì (bỏ scroll-behavior: smooth của trang) để phần được chọn nằm gần đầu khung nhìn, chừa chỗ cho header.
    function reveal(element: HTMLElement) {
      if (restoring) return;
      const rect = element.getBoundingClientRect();
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
      window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - 80), behavior: "instant" });
    }
    function highlight(index: number, scroll = false) {
      timers.splice(0).forEach(timer => window.clearTimeout(timer));
      active?.classList.remove("builder-preview-selected");
      active = document.querySelector<HTMLElement>(`[data-builder-block="${index}"]`);
      active?.classList.add("builder-preview-selected");
      if (scroll && active) {
        const target = active;
        // Ảnh và phông tải xong làm trang giãn ra, nên cuộn lại vài lần cho tới khi bố cục ổn định.
        for (const delay of [0, 250, 800, 1600]) timers.push(window.setTimeout(() => reveal(target), delay));
      }
    }
    function select(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("a,button[type='submit']")) { event.preventDefault(); event.stopImmediatePropagation(); }
      const section = target?.closest<HTMLElement>("[data-builder-block]");
      if (!section) return;
      const index = Number(section.dataset.builderBlock);
      highlight(index);
      // Mã của mục con và trường vừa bấm (gắn sẵn trên phần tử bằng data-builder-item / data-builder-field): CMS chọn đúng theo mã, không đoán theo chữ.
      const item = target?.closest<HTMLElement>("[data-builder-item]")?.dataset.builderItem;
      const field = target?.closest<HTMLElement>("[data-builder-field]")?.dataset.builderField;
      editor.postMessage({ type: "iorder:select-block", index, ...(item ? { item } : {}), ...(field ? { field } : {}) }, parentOrigin);
    }
    function receive(event: MessageEvent) {
      if (event.source !== editor || event.origin !== parentOrigin) return;
      const index = parseHighlightMessage(event.data);
      if (index !== null) highlight(index, true);
    }
    const preventSubmit = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    // Mỗi lần CMS cập nhật bản xem trước, khung tải lại từ đầu trang. Lưu vị trí cuộn và khôi phục sau khi tải lại
    // (chỉ khi vừa lưu cách đây ít giây) để trang giữ nguyên chỗ đang xem thay vì chạy từ đầu xuống mục được chọn.
    const scrollKey = "iorder:builder-preview-scroll";
    const saveScroll = () => { try { sessionStorage.setItem(scrollKey, JSON.stringify({ y: window.scrollY, path: location.pathname, at: Date.now() })); } catch { /* bộ nhớ phiên bị chặn: bỏ qua */ } };
    try {
      const saved = JSON.parse(sessionStorage.getItem(scrollKey) ?? "null") as { y?: number; path?: string; at?: number } | null;
      if (saved && saved.path === location.pathname && typeof saved.y === "number" && typeof saved.at === "number" && Date.now() - saved.at < 15000 && saved.y > 0) {
        const y = saved.y;
        restoring = true;
        // Ảnh và phông tải xong làm trang giãn ra, nên đặt lại vài lần cho tới khi trang đủ cao. Trong lúc đó không tự cuộn tới mục được chọn.
        for (const delay of [0, 100, 300, 800, 1600]) restoreTimers.push(window.setTimeout(() => window.scrollTo({ top: y, behavior: "instant" }), delay));
        restoreTimers.push(window.setTimeout(() => { restoring = false; }, 1700));
      }
    } catch { /* dữ liệu lưu hỏng: bỏ qua */ }
    // Lăn tới đầu/cuối trang xem trước thì trình duyệt chuyển phần cuộn dư ra cửa sổ CMS; chặn tại đây (CSS overscroll-behavior không đủ cho khung nhúng).
    const stopChaining = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const root = document.scrollingElement ?? document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      if ((event.deltaY < 0 && root.scrollTop <= 0) || (event.deltaY > 0 && root.scrollTop >= max - 1) || max <= 0) event.preventDefault();
    };
    window.addEventListener("wheel", stopChaining, { passive: false });
    window.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("pagehide", saveScroll);
    document.addEventListener("click", select, true);
    document.addEventListener("submit", preventSubmit, true);
    window.addEventListener("message", receive);
    editor.postMessage({ type: "iorder:preview-ready" }, parentOrigin);
    return () => {
      restoreTimers.forEach(timer => window.clearTimeout(timer));
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("wheel", stopChaining);
      window.removeEventListener("pagehide", saveScroll); document.removeEventListener("click", select, true); document.removeEventListener("submit", preventSubmit, true); window.removeEventListener("message", receive); timers.forEach(timer => window.clearTimeout(timer)); active?.classList.remove("builder-preview-selected"); };
  }, [parentOrigin]);
  // Canvas nằm trong khung nhỏ: thanh cuộn của trang xem trước làm rất mảnh (3px; ghi đè `* { scrollbar-width: thin }` của website) để khỏi chiếm chỗ.
  return <style>{"[data-builder-block]{cursor:pointer}[data-builder-item]:hover{outline:1px solid rgba(37,99,235,.35);outline-offset:-1px}[data-builder-field]:hover{outline:1px dashed #2563eb;outline-offset:2px}.builder-preview-selected{outline:2px solid #2563eb;outline-offset:-2px}html,body{overscroll-behavior:contain}.screen-hero,.screen-hero[data-hero-top]{min-height:min(100svh,800px)!important}section .hero-slider{height:min(max(100svh - var(--header-height),520px),700px)!important}[data-hero-flush] .hero-slider{height:min(max(100svh,560px),800px)!important}html{scrollbar-width:auto;scrollbar-color:auto}html::-webkit-scrollbar{width:3px;height:3px}html::-webkit-scrollbar-thumb{border-radius:999px;background:#c3ccd8}html::-webkit-scrollbar-track{background:transparent}@supports (-moz-appearance:none){html{scrollbar-width:thin}}"}</style>;
}
