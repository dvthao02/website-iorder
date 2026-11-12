"use client";

import { useEffect } from "react";
import { z } from "zod";

const highlightSchema = z.object({ type: z.literal("iorder:highlight-block"), index: z.number().int().min(0).max(99) }).strict();

/** Chỉ được gắn trong iframe có token preview hợp lệ; tương tác không được gửi form hay mở liên kết thật. */
export function BuilderPreviewBridge({ parentOrigin }: { parentOrigin: string }) {
  useEffect(() => {
    const editor: Window = window.opener ?? window.parent;
    let active: HTMLElement | null = null;
    function highlight(index: number, scroll = false) {
      active?.classList.remove("builder-preview-selected");
      active = document.querySelector<HTMLElement>(`[data-builder-block="${index}"]`);
      active?.classList.add("builder-preview-selected");
      if (scroll) active?.scrollIntoView({ behavior: "auto", block: "nearest" });
    }
    function select(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("a,button[type='submit']")) { event.preventDefault(); event.stopImmediatePropagation(); }
      const section = target?.closest<HTMLElement>("[data-builder-block]");
      if (!section) return;
      const index = Number(section.dataset.builderBlock);
      highlight(index);
      editor.postMessage({ type: "iorder:select-block", index }, parentOrigin);
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
    return () => { document.removeEventListener("click", select, true); document.removeEventListener("submit", preventSubmit, true); window.removeEventListener("message", receive); active?.classList.remove("builder-preview-selected"); };
  }, [parentOrigin]);
  return <style>{"[data-builder-block]{cursor:pointer}.builder-preview-selected{outline:2px solid #2563eb;outline-offset:-2px}"}</style>;
}
