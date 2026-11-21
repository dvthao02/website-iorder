"use client";

import { useRef, useState, type DragEvent, type PointerEvent } from "react";

export type DropPosition = "before" | "after";

/** Đưa phần tử ở vị trí from sang trước/sau phần tử target (chỉ số theo mảng ban đầu). */
export function reorder<T>(items: readonly T[], from: number, target: number, position: DropPosition): T[] {
  if (from === target) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  let insertAt = target + (position === "after" ? 1 : 0);
  if (from < insertAt) insertAt -= 1;
  next.splice(insertAt, 0, moved);
  return next;
}

/**
 * Kéo thả bằng HTML5: chỉ bắt đầu kéo khi nhấn vào tay nắm (để ô nhập/nút trong dòng vẫn dùng bình thường),
 * vạch chỉ vị trí thả hiện qua data-drop="before|after". Nút lên/xuống vẫn giữ cho bàn phím và màn cảm ứng.
 */
export function useDragReorder({ onDrop, canDrag = () => true, canDropOn = () => true, touch = false }: {
  onDrop: (from: number, target: number, position: DropPosition) => void;
  canDrag?: (index: number) => boolean;
  canDropOn?: (from: number, target: number, position: DropPosition) => boolean;
  touch?: boolean;
}) {
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<{ index: number; position: DropPosition } | null>(null);
  const pointer = useRef<{ from: number; x: number; y: number; list: HTMLElement; moved: boolean; target: { index: number; position: DropPosition } | null } | null>(null);

  function reset() { pointer.current = null; setArmed(null); setDragging(null); setOver(null); }

  function handleProps(index: number) {
    return {
      "data-drag-handle": "",
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (!canDrag(index)) return;
        setArmed(index);
        if (!touch || event.pointerType === "mouse") return;
        const list = event.currentTarget.closest<HTMLElement>("[data-reorder-index]")?.parentElement;
        if (!list) return;
        pointer.current = { from: index, x: event.clientX, y: event.clientY, list, moved: false, target: null };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const current = pointer.current;
        if (!current) return;
        if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
        current.moved = true;
        setDragging(current.from);
        let target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-reorder-index]") ?? null;
        while (target && target.parentElement !== current.list) target = target.parentElement?.closest<HTMLElement>("[data-reorder-index]") ?? null;
        const to = target ? Number(target.dataset.reorderIndex) : -1;
        const bounds = target?.getBoundingClientRect();
        const position: DropPosition = bounds && event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
        current.target = target && to !== current.from && canDropOn(current.from, to, position) ? { index: to, position } : null;
        setOver(current.target);
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        const current = pointer.current;
        if (!current) { setArmed(null); return; }
        if (current?.moved && current.target && canDrag(current.from)) onDrop(current.from, current.target.index, current.target.position);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        reset();
      },
      onPointerCancel: () => { if (pointer.current) reset(); },
      onClick: (event: { stopPropagation: () => void }) => event.stopPropagation(),
      title: "Kéo để sắp xếp",
    };
  }

  function itemProps(index: number) {
    return {
      draggable: armed === index,
      "data-reorder-index": index,
      "data-dragging": dragging === index ? "" : undefined,
      "data-drop": over?.index === index ? over.position : undefined,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        if (pointer.current) { event.preventDefault(); return; }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
        setDragging(index);
      },
      onDragEnd: reset,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (dragging === null || dragging === index) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const position: DropPosition = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
        if (!canDropOn(dragging, index, position)) { if (over) setOver(null); return; }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (over?.index !== index || over.position !== position) setOver({ index, position });
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        if (dragging !== null && over && over.index === index) onDrop(dragging, over.index, over.position);
        reset();
      },
    };
  }

  return { handleProps, itemProps, dragging };
}
