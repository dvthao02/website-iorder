"use client";

import { useEffect, useRef, useState } from "react";
import type { PageBlock } from "@iorder/shared/server/pages/pages.contract";
import { emptyHistory, recordEdit, redoEdit, undoEdit } from "./ui/edit-history";
import { PageBlocksEditor, type PageBlocksEditorProps } from "./page-blocks-editor";
import { BuilderLivePreview } from "./builder-live-preview";

/** Một builder cho pages và offerings; form nghiệp vụ và nguồn dữ liệu không phụ thuộc slug. */
export function CmsPageBuilder({ document, documentId, ...props }: Omit<PageBlocksEditorProps, "layout" | "preview" | "canvasWide" | "selectionRequest"> & { document: unknown; documentId: string | null }) {
  const [internal, setInternal] = useState<number | null>(props.leads?.length ? -1 : props.blocks.length ? 0 : null);
  // Canvas rộng: ẩn hai thanh bên để xem trang lớn; bấm chọn một phần thì tự thu lại để sửa.
  const [wide, setWide] = useState(false);
  // Lần bấm trên canvas theo mã (mục con, trường) do website gắn sẵn; seq để bấm lại cùng chỗ vẫn kích hoạt.
  const [selectionRequest, setSelectionRequest] = useState<{ index: number; item?: string; field?: string; seq: number } | null>(null);
  // Hoàn tác / Làm lại cho danh sách thành phần (Ctrl+Z, Ctrl+Shift+Z hoặc Ctrl+Y khi không gõ trong ô nhập; nút trên thanh canvas).
  // Chỉ phủ phần thay đổi danh sách thành phần; các ô của phần đầu trang/mục cố định dùng hoàn tác của chính ô nhập.
  const history = useRef(emptyHistory<PageBlock[]>());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const syncHistory = () => { setCanUndo(history.current.past.length > 0); setCanRedo(history.current.future.length > 0); };
  const commit = (next: PageBlock[]) => { history.current = recordEdit(history.current, props.blocks, Date.now()); syncHistory(); props.onChange(next); };
  const undo = () => { const step = undoEdit(history.current, props.blocks); if (!step) return; history.current = step.history; syncHistory(); props.onChange(step.value); };
  const redo = () => { const step = redoEdit(history.current, props.blocks); if (!step) return; history.current = step.history; syncHistory(); props.onChange(step.value); };
  const latest = useRef({ undo, redo });
  useEffect(() => { latest.current = { undo, redo }; });
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) latest.current.redo(); else latest.current.undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const selected = props.openIndex === undefined ? internal : props.openIndex;
  // Chỉ số hợp lệ: khối (>= 0), mục cố định đầu trang (-1…) và mục cố định cuối trang (-11…).
  const validIndex = (index: number) => index >= 0 ? index < props.blocks.length : index >= -(props.leads?.length ?? 0) || (index <= -11 && index >= -(10 + (props.tails?.length ?? 0)));
  const select = (index: number | null) => { if (index !== null && !validIndex(index)) return; if (props.onOpenIndexChange) props.onOpenIndexChange(index); else setInternal(index); };
  const pick = (index: number, item?: string, field?: string) => {
    setWide(false);
    select(index);
    // Luôn ghi nhận lần bấm (kể cả khi không có mã mục/trường) để đặt lại mục con đang chọn về thiết lập của cả khối.
    setSelectionRequest(previous => ({ index, item, field, seq: (previous?.seq ?? 0) + 1 }));
  };
  return <PageBlocksEditor {...props} onChange={commit} canvasWide={wide} layout="builder" openIndex={selected} onOpenIndexChange={select} selectionRequest={selectionRequest} preview={<BuilderLivePreview document={document} documentId={documentId} onSelect={pick} canRedo={canRedo} canUndo={canUndo} onRedo={redo} onUndo={undo} onToggleWide={() => setWide(value => !value)} selectedIndex={selected} wide={wide} />} />;
}
