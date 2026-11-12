"use client";

import { GripVertical, Plus, X } from "lucide-react";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";

import { AdminButton } from "./admin-button";
import { AdminIconButton } from "./admin-icon-button";

/** Dời mục từ `index` đi `delta` vị trí (âm = lên, dương = xuống); kéo thả có thể dời nhiều bước một lần. */
export function moveListItem<T>(items: T[], index: number, delta: number) {
  const target = Math.min(items.length - 1, Math.max(0, index + delta));
  if (target === index || index < 0 || index >= items.length) return items;
  const result = [...items];
  const [moved] = result.splice(index, 1);
  result.splice(target, 0, moved);
  return result;
}

// Một dòng của danh sách lặp (nhóm thông số, mục trong danh sách, thẻ, nhóm…): tay nắm kéo thả tìm dòng cha gần nhất theo các lớp này
// và sắp xếp trong số các dòng cùng loại nằm cùng một khung cha.
const rowKinds = [".admin-list-editor__row", ".admin-list-item", ".admin-grouped-row", ".admin-spec-group"];

type SortState = { row: HTMLElement; siblings: HTMLElement[]; from: number; to: number; x: number; y: number; moved: boolean };

/**
 * Điều khiển cuối dòng: tay nắm kéo thả để sắp xếp (chuột và cảm ứng; bàn phím dùng Alt + phím lên/xuống khi đang ở tay nắm) và nút xóa.
 * `onMove(delta)`: dời dòng đi `delta` vị trí, nên một lần thả có thể đi xa hơn một bước.
 */
export function AdminListRowControls({ index, length, label, onMove, onRemove }: { index: number; length: number; label: string; onMove: (delta: number) => void; onRemove: () => void }) {
  const sort = useRef<SortState | null>(null);
  function clearMarks() {
    sort.current?.siblings.forEach(sibling => { delete sibling.dataset.drop; delete sibling.dataset.dragging; });
  }
  function down(event: PointerEvent<HTMLButtonElement>) {
    if (length < 2 || event.button !== 0) return;
    const row = event.currentTarget.closest<HTMLElement>(rowKinds.join(","));
    const kind = row ? rowKinds.find(selector => row.matches(selector)) : undefined;
    if (!row || !kind || !row.parentElement) return;
    const siblings = Array.from(row.parentElement.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches(kind));
    const from = siblings.indexOf(row);
    if (from < 0) return;
    sort.current = { row, siblings, from, to: from, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveTo(event: PointerEvent<HTMLButtonElement>) {
    const state = sort.current;
    if (!state) return;
    if (!state.moved && Math.hypot(event.clientX - state.x, event.clientY - state.y) < 6) return;
    state.moved = true;
    state.row.dataset.dragging = "";
    // Vị trí chèn: số dòng có tâm nằm phía trên con trỏ; sau khi bỏ dòng đang kéo thì chỉ số đích lùi một nếu chèn xuống dưới.
    const insertAt = state.siblings.filter(sibling => { const box = sibling.getBoundingClientRect(); return event.clientY > box.top + box.height / 2; }).length;
    state.to = insertAt > state.from ? insertAt - 1 : insertAt;
    state.siblings.forEach(sibling => { delete sibling.dataset.drop; });
    if (state.to !== state.from) {
      if (insertAt < state.siblings.length) state.siblings[insertAt].dataset.drop = "before";
      else state.siblings[state.siblings.length - 1].dataset.drop = "after";
    }
  }
  function up(event: PointerEvent<HTMLButtonElement>) {
    const state = sort.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    clearMarks();
    sort.current = null;
    if (state?.moved && state.to !== state.from) onMove(state.to - state.from);
  }
  function key(event: KeyboardEvent<HTMLButtonElement>) {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const delta = event.key === "ArrowUp" ? -1 : 1;
    if (index + delta < 0 || index + delta >= length) return;
    const row = event.currentTarget.closest<HTMLElement>(rowKinds.join(","));
    const kind = row ? rowKinds.find(selector => row.matches(selector)) : undefined;
    const parent = row?.parentElement;
    onMove(delta);
    // Dòng đổi chỗ nên đưa tiêu điểm theo về tay nắm của dòng vừa dời.
    requestAnimationFrame(() => {
      if (!parent || !kind) return;
      Array.from(parent.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches(kind))[index + delta]?.querySelector<HTMLElement>("[data-sort-handle]")?.focus();
    });
  }
  return <span className="admin-list-editor__controls">
    <button aria-label={`Sắp xếp ${label}`} className="admin-list-editor__handle" data-sort-handle="" disabled={length < 2} onKeyDown={key} onPointerCancel={up} onPointerDown={down} onPointerMove={moveTo} onPointerUp={up} title="Kéo để sắp xếp; bàn phím dùng Alt + phím lên/xuống" type="button"><GripVertical aria-hidden="true" size={15} /></button>
    <AdminIconButton aria-label={`Xóa ${label}`} className="admin-list-editor__remove" onClick={onRemove} title="Xóa"><X aria-hidden="true" size={15} /></AdminIconButton>
  </span>;
}

/**
 * Danh sách chữ ngắn (tính năng, lợi ích, chỉ số…): mỗi mục một ô. Enter thêm mục ngay bên dưới,
 * Backspace ở ô trống xóa mục đó. Mục để trống bị bỏ khi lưu.
 */
export function AdminListEditor({ addLabel, id, itemLabel, items, maxItems, maxLength = 500, onChange, placeholder }: { addLabel: string; id?: string; itemLabel: string; items: string[]; maxItems: number; maxLength?: number; onChange: (items: string[]) => void; placeholder?: string }) {
  const listRef = useRef<HTMLOListElement>(null);
  function focusRow(index: number) {
    requestAnimationFrame(() => listRef.current?.querySelectorAll<HTMLInputElement>("input")[index]?.focus());
  }
  function insertAfter(index: number) {
    if (items.length >= maxItems) return;
    onChange([...items.slice(0, index + 1), "", ...items.slice(index + 1)]);
    focusRow(index + 1);
  }
  function remove(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") { event.preventDefault(); insertAfter(index); }
    if (event.key === "Backspace" && !items[index] && items.length > 0) { event.preventDefault(); remove(index); focusRow(Math.max(0, index - 1)); }
  }
  return <div className="admin-list-editor" id={id}>
    {items.length ? <ol className="admin-list-editor__rows" ref={listRef}>{items.map((item, index) => <li className="admin-list-editor__row" data-builder-item={index} key={index}>
      <span aria-hidden="true" className="admin-list-editor__index">{index + 1}</span>
      <input aria-label={`${itemLabel} ${index + 1}`} className="admin-input" maxLength={maxLength} onChange={(event) => onChange(items.map((entry, entryIndex) => entryIndex === index ? event.target.value : entry))} onKeyDown={(event) => keyDown(event, index)} placeholder={placeholder} value={item} />
      <AdminListRowControls index={index} label={`${itemLabel} ${index + 1}`} length={items.length} onMove={(direction) => onChange(moveListItem(items, index, direction))} onRemove={() => remove(index)} />
    </li>)}</ol> : null}
    <AdminButton className="justify-self-start" disabled={items.length >= maxItems} leadingIcon={<Plus aria-hidden="true" size={15} />} onClick={() => insertAfter(items.length - 1)} size="sm" variant="secondary">{addLabel}</AdminButton>
  </div>;
}

export type FaqItem = { question: string; answer: string };

/** Câu hỏi thường gặp: mỗi mục một cặp câu hỏi / trả lời. Mục thiếu một trong hai bị bỏ khi lưu. */
export function AdminFaqEditor({ id, items, maxItems, onChange }: { id?: string; items: FaqItem[]; maxItems: number; onChange: (items: FaqItem[]) => void }) {
  const listRef = useRef<HTMLOListElement>(null);
  function add() {
    onChange([...items, { question: "", answer: "" }]);
    requestAnimationFrame(() => { const inputs = listRef.current?.querySelectorAll<HTMLInputElement>("input"); inputs?.[inputs.length - 1]?.focus(); });
  }
  function patch(index: number, value: Partial<FaqItem>) {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item));
  }
  return <div className="admin-list-editor" id={id}>
    {items.length ? <ol className="admin-list-editor__rows" ref={listRef}>{items.map((item, index) => <li className="admin-list-editor__row admin-list-editor__row--faq" key={index}>
      <span aria-hidden="true" className="admin-list-editor__index">{index + 1}</span>
      <span className="admin-list-editor__pair">
        <input aria-label={`Câu hỏi ${index + 1}`} className="admin-input" maxLength={500} onChange={(event) => patch(index, { question: event.target.value })} placeholder="Câu hỏi" value={item.question} />
        <textarea aria-label={`Trả lời ${index + 1}`} className="admin-input" maxLength={500} onChange={(event) => patch(index, { answer: event.target.value })} placeholder="Trả lời" rows={2} value={item.answer} />
        {item.question.trim() && !item.answer.trim() || !item.question.trim() && item.answer.trim() ? <small className="admin-help admin-text-warning">Cần cả câu hỏi và trả lời, nếu không mục này sẽ bị bỏ khi lưu.</small> : null}
      </span>
      <AdminListRowControls index={index} label={`câu hỏi ${index + 1}`} length={items.length} onMove={(direction) => onChange(moveListItem(items, index, direction))} onRemove={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} />
    </li>)}</ol> : null}
    <AdminButton className="justify-self-start" disabled={items.length >= maxItems} leadingIcon={<Plus aria-hidden="true" size={15} />} onClick={add} size="sm" variant="secondary">Thêm câu hỏi</AdminButton>
  </div>;
}
