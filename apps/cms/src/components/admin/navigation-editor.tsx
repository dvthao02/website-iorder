"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { ChevronDown, ChevronRight, ChevronUp, CornerDownRight, ExternalLink, Eye, EyeOff, IndentDecrease, IndentIncrease, Link2, ListPlus, Menu, Plus, RotateCcw, Save, Search, Trash2, GripVertical, X } from "lucide-react";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import {
  parseSavedNavigationDocument,
  navigationSchema,
  type NavigationDocument,
  type NavigationItems,
  type NavigationLocation,
  type NavigationTarget,
} from "@iorder/core/server/navigation/navigation.contract";

import { RevisionHistory } from "./revision-history";
import { AdminButton } from "./ui/admin-button";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminFilterTabs } from "./ui/admin-filter-tabs";
import { AdminCard } from "./ui/admin-card";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useRevisionRestore } from "./ui/use-revision-restore";
import { useDragReorder } from "./ui/use-drag-reorder";

const locations: NavigationLocation[] = ["header", "header_cta", "footer"];
const locationLabel: Record<NavigationLocation, string> = {
  header: "Menu đầu trang",
  header_cta: "Nút tư vấn",
  footer: "Menu chân trang",
};

function createKey() {
  return `menu-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function descendants(items: NavigationItems, key: string) {
  const result = new Set([key]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (item.parentKey && result.has(item.parentKey) && !result.has(item.key)) {
        result.add(item.key);
        changed = true;
      }
    }
  }
  return result;
}

function depth(items: NavigationItems, item: NavigationItems[number]) {
  const byKey = new Map(items.map((entry) => [entry.key, entry]));
  let current = item.parentKey;
  let result = 0;
  while (current) {
    result += 1;
    current = byKey.get(current)?.parentKey ?? null;
  }
  return result;
}

function siblingIndexes(items: NavigationItems, parentKey: string | null) {
  return items.flatMap((item, index) => item.parentKey === parentKey ? [index] : []);
}

function rangeEnd(items: NavigationItems, index: number) {
  const keys = descendants(items, items[index].key);
  let end = index + 1;
  while (end < items.length && keys.has(items[end].key)) end += 1;
  return end;
}

function moveSibling(items: NavigationItems, index: number, direction: -1 | 1) {
  const siblings = siblingIndexes(items, items[index].parentKey);
  const siblingPosition = siblings.indexOf(index);
  const siblingIndex = siblings[siblingPosition + direction];
  if (siblingIndex === undefined) return items;

  const firstIndex = Math.min(index, siblingIndex);
  const secondIndex = Math.max(index, siblingIndex);
  const firstEnd = rangeEnd(items, firstIndex);
  const secondEnd = rangeEnd(items, secondIndex);
  return [
    ...items.slice(0, firstIndex),
    ...items.slice(secondIndex, secondEnd),
    ...items.slice(firstEnd, secondIndex),
    ...items.slice(firstIndex, firstEnd),
    ...items.slice(secondEnd),
  ];
}

// Kéo thả: đưa cả nhánh (mục + mục con) tới trước/sau một mục cùng cấp; không đổi mục cha.
function moveBranch(items: NavigationItems, from: number, target: number, position: "before" | "after") {
  const fromEnd = rangeEnd(items, from);
  const branch = items.slice(from, fromEnd);
  const rest = [...items.slice(0, from), ...items.slice(fromEnd)];
  const targetIndex = rest.findIndex((item) => item.key === items[target].key);
  const insertAt = position === "before" ? targetIndex : rangeEnd(rest, targetIndex);
  return [...rest.slice(0, insertAt), ...branch, ...rest.slice(insertAt)];
}

function indentItem(items: NavigationItems, index: number) {
  const siblings = siblingIndexes(items, items[index].parentKey);
  const previous = siblings[siblings.indexOf(index) - 1];
  if (previous === undefined) return items;
  return items.map((item, position) => position === index ? { ...item, parentKey: items[previous].key } : item);
}

function outdentItem(items: NavigationItems, index: number) {
  const item = items[index];
  const parent = items.find((entry) => entry.key === item.parentKey);
  if (!parent) return items;
  const fromEnd = rangeEnd(items, index);
  const branch = items.slice(index, fromEnd).map((entry, position) => position === 0 ? { ...entry, parentKey: parent.parentKey } : entry);
  const rest = [...items.slice(0, index), ...items.slice(fromEnd)];
  const insertAt = rangeEnd(rest, rest.findIndex((entry) => entry.key === parent.key));
  return [...rest.slice(0, insertAt), ...branch, ...rest.slice(insertAt)];
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/**
 * Ô liên kết duy nhất (kiểu Shopify): gõ để tìm trang/bài viết/sản phẩm đã xuất bản, hoặc nhập/dán đường dẫn.
 * Chọn kết quả → liên kết trực tiếp (tự theo slug); gõ đường dẫn → liên kết tự nhập.
 */
function LinkPicker({ item, targets, onLink, onCustom }: { item: NavigationItems[number]; targets: NavigationTarget[]; onLink: (target: NavigationTarget) => void; onCustom: (url: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(0);
  const linked = item.linkType !== "custom" ? targets.find((target) => target.id === item.contentId && target.linkType === item.linkType) : undefined;
  const query = normalize(item.linkType === "custom" ? item.url.trim() : "");
  const matches = (query && query !== "/" ? targets.filter((target) => normalize(target.label).includes(query) || normalize(target.url).includes(query)) : targets).slice(0, 8);

  if (linked && !editing) return <div className="admin-field">
    <span>Liên kết</span>
    <div className="admin-link-picker__linked">
      <Link2 aria-hidden="true" size={16} />
      <span><strong>{linked.label}</strong><small>{linked.typeLabel} · {linked.url}</small></span>
      <button className="admin-link-picker__change" onClick={() => { setEditing(true); setOpen(true); }} type="button">Đổi liên kết</button>
    </div>
    <span className="admin-help">Liên kết trực tiếp: tự cập nhật khi nội dung đổi đường dẫn, tự ẩn khi bị gỡ xuất bản.</span>
  </div>;

  function pick(target: NavigationTarget) { onLink(target); setOpen(false); setEditing(false); }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((current) => Math.min(current + 1, matches.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)); }
    if (event.key === "Enter") { event.preventDefault(); if (open && matches[active]) pick(matches[active]); else setOpen(false); }
    if (event.key === "Escape") setOpen(false);
  }

  return <div className="admin-field admin-link-picker">
    <label htmlFor={`${id}-input`}>Liên kết</label>
    <div className="admin-link-picker__control">
      <Search aria-hidden="true" size={15} />
      <input aria-autocomplete="list" aria-controls={`${id}-list`} aria-describedby={`${id}-help`} aria-expanded={open && matches.length > 0} autoComplete="off" className="admin-input" id={`${id}-input`}
        onBlur={() => setTimeout(() => setOpen(false), 120)} onChange={(event) => { onCustom(event.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
        placeholder="Tìm trang, bài viết, sản phẩm… hoặc dán đường dẫn" role="combobox" value={item.linkType === "custom" ? item.url : ""} />
    </div>
    {open && matches.length ? <ul className="admin-link-picker__list" id={`${id}-list`} role="listbox">{matches.map((target, index) => <li aria-selected={index === active} key={`${target.linkType}:${target.id}`} onMouseDown={(event) => { event.preventDefault(); pick(target); }} onMouseEnter={() => setActive(index)} role="option">
      <strong>{target.label}</strong><small>{target.typeLabel} · {target.url}</small>
    </li>)}</ul> : null}
    <span className="admin-help" id={`${id}-help`}>{item.linkType === "custom" ? "Đang dùng đường dẫn tự nhập. Chọn một trang trong danh sách để liên kết trực tiếp." : "Chọn trang trong danh sách hoặc gõ đường dẫn."}{linked ? <> <button className="admin-link-picker__change" onClick={() => { setEditing(false); setOpen(false); }} type="button">Giữ liên kết cũ</button></> : null}</span>
  </div>;
}

function sameItems(first: NavigationItems, second: NavigationItems) {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function NavigationEditor({ menus, targets }: { menus: Record<NavigationLocation, NavigationDocument>; targets: NavigationTarget[] }) {
  const { show: showToast } = useAdminToast();
  const [activeLocation, setActiveLocation] = useState<NavigationLocation>("header");
  const [documents, setDocuments] = useState(menus);
  const [savedDocuments, setSavedDocuments] = useState(menus);
  const [selectedKey, setSelectedKey] = useState<string | null>(menus.header.items[0]?.key ?? null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [quickAdd, setQuickAdd] = useState<{ open: boolean; query: string; picked: string[] }>({ open: false, query: "", picked: [] });
  const [isSaving, setBusy] = useState(false);
  const revisionRestore = useRevisionRestore();
  const busy = isSaving || revisionRestore.restoring;
  const saving = useRef(false);

  const currentDocument = documents[activeLocation];
  const items = currentDocument.items;
  const selectedIndex = items.findIndex((item) => item.key === selectedKey);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;
  const dirty = !sameItems(items, savedDocuments[activeLocation].items);
  const hasUnsavedChanges = useMemo(
    () => locations.some((location) => !sameItems(documents[location].items, savedDocuments[location].items)),
    [documents, savedDocuments],
  );

  useNavigationGuard(!revisionRestore.completing && (hasUnsavedChanges || busy), () => {
    showToast(saving.current || revisionRestore.pending.current ? "Đang xử lý menu. Vui lòng chờ trước khi rời trang." : "Bạn có thay đổi menu chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi rời trang.", "warning");
  });

  function updateItems(next: NavigationItems) {
    if (saving.current || revisionRestore.pending.current) return;
    setDocuments((current) => ({
      ...current,
      [activeLocation]: { ...current[activeLocation], items: next },
    }));
  }

  function updateSelected(patch: Partial<NavigationItems[number]>) {
    if (selectedIndex < 0) return;
    updateItems(items.map((item, index) => index === selectedIndex ? { ...item, ...patch } : item));
  }

  function changeLocation(next: NavigationLocation) {
    if (saving.current || revisionRestore.pending.current) return;
    if (next === activeLocation) return;
    setActiveLocation(next);
    setSelectedKey(documents[next].items[0]?.key ?? null);
  }

  function addItem(parentKey: string | null = null) {
    if (saving.current || revisionRestore.pending.current) return;
    const entry: NavigationItems[number] = {
      key: createKey(),
      parentKey,
      label: "Mục menu mới",
      url: "/",
      linkType: "custom",
      contentId: null,
      target: "_self",
      isEnabled: true,
    };
    if (!parentKey) updateItems([...items, entry]);
    else {
      const parentIndex = items.findIndex((item) => item.key === parentKey);
      const insertionIndex = rangeEnd(items, parentIndex);
      updateItems([...items.slice(0, insertionIndex), entry, ...items.slice(insertionIndex)]);
    }
    setSelectedKey(entry.key);
  }

  function removeItem(key: string) {
    if (saving.current || revisionRestore.pending.current) return;
    const target = items.find((item) => item.key === key);
    if (!target) return;
    const keys = descendants(items, key);
    const next = items.filter((item) => !keys.has(item.key));
    updateItems(next);
    if (selectedKey && keys.has(selectedKey)) setSelectedKey(target.parentKey ?? next[0]?.key ?? null);
    showToast(keys.size > 1 ? `Đã loại “${target.label}” và ${keys.size - 1} mục con. Lưu menu để áp dụng hoặc bấm Bỏ thay đổi.` : `Đã loại “${target.label}”. Lưu menu để áp dụng hoặc bấm Bỏ thay đổi.`, "warning");
  }

  function toggleEnabled(key: string) {
    updateItems(items.map((item) => item.key === key ? { ...item, isEnabled: !item.isEnabled } : item));
  }

  function addChild(key: string) {
    setCollapsed((current) => { const next = new Set(current); next.delete(key); return next; });
    addItem(key);
  }

  // Thêm nhanh nhiều trang/nội dung có sẵn (kiểu WordPress) thành mục cấp 1, liên kết trực tiếp.
  const linkedIds = new Set(items.filter((item) => item.contentId).map((item) => `${item.linkType}:${item.contentId}`));
  const available = targets.filter((target) => !linkedIds.has(`${target.linkType}:${target.id}`) && (!quickAdd.query || normalize(`${target.label} ${target.url}`).includes(normalize(quickAdd.query))));
  function addPicked() {
    const picked = targets.filter((target) => quickAdd.picked.includes(`${target.linkType}:${target.id}`));
    if (!picked.length || saving.current || revisionRestore.pending.current) return;
    const entries: NavigationItems = picked.map((target) => ({ key: createKey(), parentKey: null, label: target.label, url: target.url, linkType: target.linkType, contentId: target.id, target: "_self", isEnabled: true }));
    updateItems([...items, ...entries]);
    setSelectedKey(entries[entries.length - 1].key);
    setQuickAdd({ open: false, query: "", picked: [] });
    showToast(`Đã thêm ${entries.length} mục vào cuối menu. Kéo thả để sắp xếp rồi lưu menu.`, "success");
  }

  function selectPublishedTarget(targetId: string) {
    const target = targets.find((entry) => `${entry.linkType}:${entry.id}` === targetId);
    if (!target) {
      updateSelected({ linkType: "custom", contentId: null });
      return;
    }
    updateSelected({
      contentId: target.id,
      linkType: target.linkType,
      url: target.url,
      ...(selected?.label === "Mục menu mới" ? { label: target.label } : {}),
    });
  }

  function discardChanges() {
    if (saving.current || revisionRestore.pending.current) return;
    const saved = savedDocuments[activeLocation];
    setDocuments((current) => ({ ...current, [activeLocation]: saved }));
    setSelectedKey(saved.items[0]?.key ?? null);
    showToast("Đã bỏ các thay đổi chưa lưu.", "info");
  }

  async function save() {
    if (saving.current || revisionRestore.pending.current || !dirty) return;
    const parsed = navigationSchema.safeParse(items);
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message ?? "Dữ liệu menu chưa hợp lệ.", "error");
      return;
    }
    saving.current = true;
    setBusy(true);
    const selectedPosition = selectedIndex;
    try {
      const response = await fetch("/api/admin/navigation", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location: activeLocation,
          version: savedDocuments[activeLocation].version,
          items: parsed.data,
          changeNote: "Cập nhật từ trình biên tập menu",
        }),
      });
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không thể lưu menu.");
      const nextDocument = parseSavedNavigationDocument(payload.menu, savedDocuments[activeLocation]);
      if (!nextDocument) throw new Error("Phản hồi lưu menu không hợp lệ hoặc không khớp. Vui lòng tải lại để kiểm tra trước khi thử lại.");
      setDocuments((current) => ({ ...current, [activeLocation]: nextDocument }));
      setSavedDocuments((current) => ({ ...current, [activeLocation]: nextDocument }));
      setSelectedKey(nextDocument.items[selectedPosition]?.key ?? nextDocument.items[0]?.key ?? null);
      showToast("Đã cập nhật menu và lưu một phiên bản mới.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const drag = useDragReorder({
    canDrag: () => !busy,
    canDropOn: (from, target) => items[from]?.parentKey === items[target]?.parentKey && !descendants(items, items[from].key).has(items[target].key),
    onDrop: (from, target, position) => updateItems(moveBranch(items, from, target, position)),
  });

  const siblingPositions = selected ? siblingIndexes(items, selected.parentKey) : [];
  const siblingPosition = selectedIndex >= 0 ? siblingPositions.indexOf(selectedIndex) : -1;
  const childrenOf = (key: string) => items.filter((item) => item.parentKey === key);
  const otherDirty = locations.filter((location) => location !== activeLocation && !sameItems(documents[location].items, savedDocuments[location].items));
  const typeOf = (item: NavigationItems[number]) => item.linkType === "custom" ? "Tự nhập" : targets.find((target) => target.id === item.contentId)?.typeLabel ?? "Nội dung";
  // Mục nằm trong nhánh đang thu gọn thì ẩn khỏi cây.
  const hiddenKeys = new Set<string>();
  for (const key of collapsed) for (const descendant of descendants(items, key)) if (descendant !== key) hiddenKeys.add(descendant);

  // Xem trước gần giống trên website: mục cấp 1 (đang hiện) và mục con bên dưới; bấm để chọn sửa.
  const preview = items.length ? <div aria-label="Xem trước trên website" className={`admin-nav-preview admin-nav-preview--${activeLocation}`} role="group">
    <span className="admin-nav-preview__label">Xem trước</span>
    <ul>{items.filter((item) => !item.parentKey && item.isEnabled).map((item) => {
      const children = childrenOf(item.key).filter((child) => child.isEnabled);
      return <li key={item.key}>
        <button className={selectedKey === item.key ? "admin-nav-preview__item admin-nav-preview__item--active" : "admin-nav-preview__item"} disabled={busy} onClick={() => setSelectedKey(item.key)} type="button">{item.label}{children.length ? <ChevronDown aria-hidden="true" size={13} /> : null}</button>
        {children.length ? <ul className="admin-nav-preview__sub">{children.map((child) => <li key={child.key}><button className={selectedKey === child.key ? "admin-nav-preview__item admin-nav-preview__item--active" : "admin-nav-preview__item"} disabled={busy} onClick={() => setSelectedKey(child.key)} type="button">{child.label}</button></li>)}</ul> : null}
      </li>;
    })}</ul>
  </div> : null;

  const quickAddPanel = quickAdd.open ? <div className="admin-nav-quick" role="group" aria-label="Thêm nhanh trang có sẵn">
    <div className="admin-nav-quick__head">
      <strong>Thêm nhanh trang có sẵn</strong>
      <button aria-label="Đóng thêm nhanh" className="admin-nav-quick__close" onClick={() => setQuickAdd({ open: false, query: "", picked: [] })} type="button"><X aria-hidden="true" size={16} /></button>
    </div>
    <input aria-label="Tìm trang có sẵn" className="admin-input" onChange={(event) => setQuickAdd((current) => ({ ...current, query: event.target.value }))} placeholder="Tìm theo tên hoặc đường dẫn…" type="search" value={quickAdd.query} />
    <ul className="admin-nav-quick__list">{available.length ? available.map((target) => {
      const value = `${target.linkType}:${target.id}`;
      return <li key={value}><label className="admin-check"><input checked={quickAdd.picked.includes(value)} onChange={(event) => setQuickAdd((current) => ({ ...current, picked: event.target.checked ? [...current.picked, value] : current.picked.filter((entry) => entry !== value) }))} type="checkbox" /><span><strong>{target.label}</strong><small>{target.typeLabel} · {target.url}</small></span></label></li>;
    }) : <li className="admin-help">Không còn trang nào chưa có trong menu.</li>}</ul>
    <AdminButton disabled={!quickAdd.picked.length || busy} onClick={addPicked} size="sm">{quickAdd.picked.length ? `Thêm ${quickAdd.picked.length} mục vào menu` : "Chọn trang để thêm"}</AdminButton>
  </div> : null;

  const tree = <div className="admin-nav-editor__tree">
    <div className="admin-nav-editor__tree-tools">
      <AdminButton disabled={busy} onClick={() => setQuickAdd((current) => ({ ...current, open: !current.open }))} size="sm" variant="secondary"><ListPlus aria-hidden="true" size={15} />Thêm nhanh trang có sẵn</AdminButton>
      {items.some((item) => childrenOf(item.key).length) ? <AdminButton onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(items.filter((item) => childrenOf(item.key).length).map((item) => item.key)))} size="sm" variant="ghost">{collapsed.size ? "Mở rộng tất cả" : "Thu gọn tất cả"}</AdminButton> : null}
    </div>
    {quickAddPanel}
    <div className="admin-select-list">
      {items.map((item, index) => {
        if (hiddenKeys.has(item.key)) return null;
        const childCount = childrenOf(item.key).length;
        const isCollapsed = collapsed.has(item.key);
        return <div className={selectedKey === item.key ? "admin-sortable-row admin-nav-row admin-nav-row--active" : "admin-sortable-row admin-nav-row"} key={item.key} style={{ paddingLeft: `${Math.min(depth(items, item), 4) * 22}px` }} {...drag.itemProps(index)}>
          <span aria-hidden="true" className="admin-drag-handle" {...drag.handleProps(index)}><GripVertical size={15} /></span>
          {childCount ? <button aria-expanded={!isCollapsed} aria-label={isCollapsed ? `Mở ${item.label}` : `Thu gọn ${item.label}`} className="admin-nav-row__icon" onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(item.key)) next.delete(item.key); else next.add(item.key); return next; })} type="button">{isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button> : <span className="admin-nav-row__spacer" />}
          <button aria-current={selectedKey === item.key ? "true" : undefined} className="admin-nav-row__main" disabled={busy} onClick={() => setSelectedKey(item.key)} type="button">
            {item.parentKey ? <CornerDownRight aria-hidden="true" className="shrink-0" size={14} /> : null}
            <span className="grid min-w-0 flex-1"><strong className="truncate">{item.label}</strong><small className="truncate">{item.url}{isCollapsed && childCount ? ` · ${childCount} mục con` : ""}</small></span>
            <span className="admin-nav-row__type">{typeOf(item)}</span>
            {item.target === "_blank" ? <ExternalLink aria-label="Mở tab mới" className="shrink-0 text-[var(--cms-muted)]" size={14} /> : null}
            {!item.isEnabled ? <AdminStatusBadge>Ẩn</AdminStatusBadge> : null}
          </button>
          <span className="admin-nav-row__actions">
            <button aria-label={item.isEnabled ? `Ẩn ${item.label}` : `Hiện ${item.label}`} className="admin-nav-row__icon" disabled={busy} onClick={() => toggleEnabled(item.key)} title={item.isEnabled ? "Ẩn khỏi website" : "Hiện trên website"} type="button">{item.isEnabled ? <Eye size={15} /> : <EyeOff size={15} />}</button>
            <button aria-label={`Thêm mục con cho ${item.label}`} className="admin-nav-row__icon" disabled={busy} onClick={() => addChild(item.key)} title="Thêm mục con" type="button"><Plus size={15} /></button>
            <button aria-label={`Xóa ${item.label}`} className="admin-nav-row__icon admin-nav-row__icon--danger" disabled={busy} onClick={() => removeItem(item.key)} title="Loại khỏi menu" type="button"><Trash2 size={15} /></button>
          </span>
        </div>;
      })}
      {items.length === 0 ? <AdminEmptyState action={<AdminButton onClick={() => addItem()}>Thêm mục đầu tiên</AdminButton>} description="Menu này chưa có mục nào." icon={<Menu aria-hidden="true" size={18} />} title="Menu trống" /> : null}
    </div>
  </div>;

  const form = <section aria-label="Sửa mục menu" className="admin-nav-editor__form">
    <fieldset disabled={busy} className="grid min-w-0 gap-4">
      {selected ? <>
        <header className="admin-nav-editor__form-head"><h2>Sửa mục: {selected.label || "(chưa đặt tên)"}</h2>{selected.parentKey ? <p className="admin-help">Mục con của “{items.find((item) => item.key === selected.parentKey)?.label}”</p> : <p className="admin-help">Mục cấp 1</p>}</header>
        <label className="admin-field">Nhãn hiển thị<input className="admin-input" maxLength={180} onChange={(event) => updateSelected({ label: event.target.value })} required value={selected.label} /></label>
        <LinkPicker item={selected} key={selected.key} onCustom={(url) => updateSelected({ linkType: "custom", contentId: null, url })} onLink={(target) => selectPublishedTarget(`${target.linkType}:${target.id}`)} targets={targets} />
        <div className="admin-form-grid">
          <label className="admin-field">Khi bấm<select className="admin-input" onChange={(event) => updateSelected({ target: event.target.value as "_self" | "_blank" })} value={selected.target}><option value="_self">Mở trong cùng tab</option><option value="_blank">Mở tab mới</option></select></label>
          <label className="admin-check self-end"><input checked={selected.isEnabled} onChange={(event) => updateSelected({ isEnabled: event.target.checked })} type="checkbox" />Hiển thị trên website</label>
        </div>
        <div className="admin-nav-editor__item-actions" role="group" aria-label="Vị trí mục">
          <AdminButton disabled={siblingPosition <= 0} onClick={() => updateItems(moveSibling(items, selectedIndex, -1))} size="sm" title="Lên trên (cùng cấp)" variant="secondary"><ChevronUp aria-hidden="true" size={16} />Lên</AdminButton>
          <AdminButton disabled={siblingPosition < 0 || siblingPosition >= siblingPositions.length - 1} onClick={() => updateItems(moveSibling(items, selectedIndex, 1))} size="sm" title="Xuống dưới (cùng cấp)" variant="secondary"><ChevronDown aria-hidden="true" size={16} />Xuống</AdminButton>
          <AdminButton disabled={siblingPosition <= 0} onClick={() => updateItems(indentItem(items, selectedIndex))} size="sm" title="Thành mục con của mục phía trên" variant="secondary"><IndentIncrease aria-hidden="true" size={16} />Đưa vào trong</AdminButton>
          <AdminButton disabled={!selected.parentKey} onClick={() => updateItems(outdentItem(items, selectedIndex))} size="sm" title="Lên một cấp" variant="secondary"><IndentDecrease aria-hidden="true" size={16} />Đưa ra ngoài</AdminButton>
        </div>
        <div className="admin-nav-editor__item-actions">
          <AdminButton onClick={() => addChild(selected.key)} size="sm" variant="secondary"><CornerDownRight aria-hidden="true" size={16} />Thêm mục con</AdminButton>
          <AdminButton className="ml-auto" onClick={() => removeItem(selected.key)} size="sm" variant="danger"><Trash2 aria-hidden="true" size={16} />Loại khỏi menu</AdminButton>
        </div>
      </> : <AdminEmptyState action={<AdminButton onClick={() => addItem()}>Thêm mục menu</AdminButton>} description="Chọn một mục ở danh sách bên trái hoặc tạo mục mới." icon={<Menu aria-hidden="true" size={20} />} title="Chưa chọn mục" />}
    </fieldset>
    {currentDocument.id ? <details className="admin-nav-editor__history"><summary>Lịch sử phiên bản menu</summary><RevisionHistory disabled={dirty || busy} expectedVersion={currentDocument.version} id={currentDocument.id} target="navigation" onRestorePendingChange={revisionRestore.onPendingChange} onRestored={revisionRestore.onRestored} /></details> : null}
  </section>;

  // Bố cục 2 cột ngay trên trang (không che danh sách): trái là cây menu, phải là ô sửa mục đang chọn.
  // Thanh lưu ghim ở đáy: lưu cả menu đang mở, báo menu khác còn thay đổi chưa lưu.
  return <AdminCard className="admin-list-manager__card admin-nav-editor">
    <AdminListHeader actions={<AdminButton disabled={busy} leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => addItem()}>Thêm mục</AdminButton>} description={`${items.length} mục trong ${locationLabel[activeLocation].toLocaleLowerCase("vi")}`} headingLevel={1} title="Menu & Điều hướng" />
    <AdminFilterTabs ariaLabel="Vị trí menu" disabled={busy} items={locations.map((location) => ({ label: `${locationLabel[location]} · ${!sameItems(documents[location].items, savedDocuments[location].items) ? "chưa lưu" : documents[location].items.length}`, value: location }))} onValueChange={changeLocation} value={activeLocation} />
    {preview}
    <div className="admin-nav-editor__body">{tree}{form}</div>
    <AdminEditorActions>
      <p className={dirty || otherDirty.length ? "admin-help admin-text-warning" : "admin-help"} role="status">{dirty ? `Có thay đổi chưa lưu trong ${locationLabel[activeLocation].toLocaleLowerCase("vi")}.` : `Đã lưu · Phiên bản ${currentDocument.version}`}{otherDirty.length ? ` ${otherDirty.map((location) => locationLabel[location]).join(", ")} cũng có thay đổi chưa lưu.` : ""}</p>
      {dirty ? <AdminButton disabled={busy} onClick={discardChanges} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton> : null}
      <AdminButton disabled={busy || !dirty} onClick={save} permission="navigation.update"><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : `Lưu ${locationLabel[activeLocation].toLocaleLowerCase("vi")}`}</AdminButton>
    </AdminEditorActions>
  </AdminCard>;
}
