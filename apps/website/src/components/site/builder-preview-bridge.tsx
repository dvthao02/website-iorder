"use client";

import { useEffect } from "react";
import { z } from "zod";

const highlightSchema = z.object({ type: z.literal("iorder:highlight-block"), index: z.number().int().min(-19).max(99) }).strict();

/** Chỉ được gắn trong iframe có token preview hợp lệ; tương tác không được gửi form hay mở liên kết thật. */
export function BuilderPreviewBridge({ parentOrigin }: { parentOrigin: string }) {
  useEffect(() => {
    const editor: Window = window.opener ?? window.parent;
    let active: HTMLElement | null = null;
    const timers: number[] = [];
    // Cuộn tức thì (bỏ scroll-behavior: smooth của trang) để phần được chọn nằm gần đầu khung nhìn, chừa chỗ cho header.
    function reveal(element: HTMLElement) {
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
      const parsed = highlightSchema.safeParse(event.data);
      if (parsed.success) highlight(parsed.data.index, true);
    }
    const preventSubmit = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    document.addEventListener("click", select, true);
    document.addEventListener("submit", preventSubmit, true);
    window.addEventListener("message", receive);
    editor.postMessage({ type: "iorder:preview-ready" }, parentOrigin);
    return () => { document.removeEventListener("click", select, true); document.removeEventListener("submit", preventSubmit, true); window.removeEventListener("message", receive); timers.forEach(timer => window.clearTimeout(timer)); active?.classList.remove("builder-preview-selected"); };
  }, [parentOrigin]);
  // Canvas nằm trong khung nhỏ: thanh cuộn của trang xem trước làm rất mảnh (3px; ghi đè `* { scrollbar-width: thin }` của website) để khỏi chiếm chỗ.
  return <style>{"[data-builder-block]{cursor:pointer}[data-builder-item]:hover{outline:1px solid rgba(37,99,235,.35);outline-offset:-1px}[data-builder-field]:hover{outline:1px dashed #2563eb;outline-offset:2px}.builder-preview-selected{outline:2px solid #2563eb;outline-offset:-2px}html{scrollbar-width:auto;scrollbar-color:auto}html::-webkit-scrollbar{width:3px;height:3px}html::-webkit-scrollbar-thumb{border-radius:999px;background:#c3ccd8}html::-webkit-scrollbar-track{background:transparent}@supports (-moz-appearance:none){html{scrollbar-width:thin}}"}</style>;
}
