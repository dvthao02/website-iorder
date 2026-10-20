"use client";

import { useState, type DragEvent } from "react";

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
export function useDragReorder({ onDrop, canDrag = () => true, canDropOn = () => true }: {
  onDrop: (from: number, target: number, position: DropPosition) => void;
  canDrag?: (index: number) => boolean;
  canDropOn?: (from: number, target: number, position: DropPosition) => boolean;
}) {
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<{ index: number; position: DropPosition } | null>(null);

  function reset() { setArmed(null); setDragging(null); setOver(null); }

  function handleProps(index: number) {
    return {
      "data-drag-handle": "",
      onPointerDown: () => { if (canDrag(index)) setArmed(index); },
      onPointerUp: () => setArmed(null),
      onClick: (event: { stopPropagation: () => void }) => event.stopPropagation(),
      title: "Kéo để sắp xếp",
    };
  }

  function itemProps(index: number) {
    return {
      draggable: armed === index,
      "data-dragging": dragging === index ? "" : undefined,
      "data-drop": over?.index === index ? over.position : undefined,
      onDragStart: (event: DragEvent<HTMLElement>) => {
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
