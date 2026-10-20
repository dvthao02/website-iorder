"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ImageOff, Maximize2, TextAlignCenter, TextAlignEnd, TextAlignStart } from "lucide-react";
import { useState, type PointerEvent as ReactPointerEvent } from "react";

import { imageWidthLimits, type ImageAlign } from "@iorder/core/server/shared/rich-text";

// Kiểu ngắt dòng như Word: "Trên và dưới" (chữ không chạy quanh) hoặc chữ bao quanh ảnh.
export const imageWraps: { value: ImageAlign; label: string; Icon: typeof TextAlignStart }[] = [
  { value: "left", label: "Chữ bao quanh, ảnh bên trái", Icon: TextAlignStart },
  { value: "center", label: "Trên và dưới (ảnh đứng riêng một dòng)", Icon: TextAlignCenter },
  { value: "right", label: "Chữ bao quanh, ảnh bên phải", Icon: TextAlignEnd },
];

const corners = [
  { id: "nw", side: -1 }, { id: "ne", side: 1 }, { id: "sw", side: -1 }, { id: "se", side: 1 },
] as const;

const clampWidth = (value: number) => Math.min(imageWidthLimits.max, Math.max(imageWidthLimits.min, Math.round(value)));

/** Ảnh trong trình soạn thảo: rê chuột để thấy tay nắm kéo đổi kích thước và thanh chọn kiểu ngắt dòng. */
export function ImageView({ node, editor, selected, updateAttributes }: NodeViewProps) {
  const { src, alt, title } = node.attrs as { src: string; alt: string | null; title: string | null };
  const width = Number(node.attrs.width) || 100;
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  // Ảnh đã bị xóa khỏi thư viện (hoặc không tải được): báo rõ thay vì một ô vỡ khó thấy.
  const [missingSrc, setMissingSrc] = useState<string | null>(null);
  const missing = missingSrc === src;
  const shown = dragWidth ?? width;
  const align: ImageAlign = shown >= 100 ? "center" : node.attrs.align ?? "center";
  const editable = editor.isEditable;

  function startResize(event: ReactPointerEvent<HTMLSpanElement>, side: 1 | -1) {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const figure = handle.closest<HTMLElement>(".admin-rte-image");
    const content = editor.view.dom as HTMLElement;
    if (!figure) return;
    const style = getComputedStyle(content);
    const available = content.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const startX = event.clientX;
    const startWidth = figure.getBoundingClientRect().width;
    // Ảnh căn giữa nở về cả hai phía nên kéo một bên tính gấp đôi.
    const factor = align === "center" ? 2 : 1;
    let next = width;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      next = clampWidth(((startWidth + (moveEvent.clientX - startX) * side * factor) / available) * 100);
      setDragWidth(next);
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      setDragWidth(null);
      if (next !== width) updateAttributes({ width: next });
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function setWrap(value: ImageAlign) {
    // Chữ bao quanh cần ảnh nhỏ hơn khung; ảnh đang toàn khổ thì thu về một nửa.
    updateAttributes({ align: value, ...(value !== "center" && width >= 100 ? { width: 50 } : {}) });
  }

  const className = ["admin-rte-image", `admin-rte-image--${align}`, selected ? "is-selected" : "", dragWidth !== null ? "is-resizing" : ""].filter(Boolean).join(" ");
  return <NodeViewWrapper className={className} data-align={align} data-width={shown} style={{ width: `${shown}%` }}>
    {/* eslint-disable-next-line @next/next/no-img-element -- ảnh trong vùng soạn thảo, website dùng next/image */}
    {missing ? <span className="admin-rte-image__missing" contentEditable={false}><ImageOff aria-hidden size={22} /><strong>Ảnh không còn trong Thư viện media</strong><small>Bấm chọn khung này rồi nhấn Delete để xóa, sau đó chèn ảnh khác.</small></span> : <img alt={alt ?? ""} draggable={false} onError={() => setMissingSrc(src)} src={src} />}
    {title ? <span className="admin-rte-image__caption">{title}</span> : null}
    {editable ? <>
      <span className="admin-rte-image__bar" contentEditable={false}>
        {imageWraps.map(({ value, label, Icon }) => <button aria-label={label} aria-pressed={align === value} className={align === value ? "admin-rte-image__btn is-active" : "admin-rte-image__btn"} key={value} onClick={() => setWrap(value)} onMouseDown={(event) => event.preventDefault()} title={label} type="button"><Icon size={14} /></button>)}
        <span className="admin-rte-image__sep" />
        <button aria-label="Toàn khổ" className={shown >= 100 ? "admin-rte-image__btn is-active" : "admin-rte-image__btn"} onClick={() => updateAttributes({ width: 100, align: "center" })} onMouseDown={(event) => event.preventDefault()} title="Toàn khổ (rộng hết khung bài)" type="button"><Maximize2 size={14} /></button>
        <span className="admin-rte-image__size">{shown}%</span>
      </span>
      {corners.map((corner) => <span aria-hidden className={`admin-rte-image__handle admin-rte-image__handle--${corner.id}`} contentEditable={false} key={corner.id} onPointerDown={(event) => startResize(event, corner.side)} title="Kéo để đổi kích thước" />)}
    </> : null}
  </NodeViewWrapper>;
}
