"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";

import { AdminButton } from "./admin-button";
import { AdminIconButton } from "./admin-icon-button";

export function moveListItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const result = [...items];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export function AdminListRowControls({ index, length, label, onMove, onRemove }: { index: number; length: number; label: string; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  return <span className="admin-list-editor__controls">
    <AdminIconButton aria-label={`Đưa ${label} lên`} disabled={index === 0} onClick={() => onMove(-1)} title="Lên"><ArrowUp aria-hidden="true" size={15} /></AdminIconButton>
    <AdminIconButton aria-label={`Đưa ${label} xuống`} disabled={index === length - 1} onClick={() => onMove(1)} title="Xuống"><ArrowDown aria-hidden="true" size={15} /></AdminIconButton>
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
    {items.length ? <ol className="admin-list-editor__rows" ref={listRef}>{items.map((item, index) => <li className="admin-list-editor__row" key={index}>
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
