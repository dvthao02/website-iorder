"use client";

import { ChevronDown, ChevronUp, CornerDownRight, Menu, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  navigationDocumentSchema,
  navigationSchema,
  type NavigationDocument,
  type NavigationItems,
  type NavigationLocation,
} from "@iorder/core/server/navigation/navigation.contract";

import { RevisionHistory } from "./revision-history";
import { AdminButton } from "./ui/admin-button";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminCard } from "./ui/admin-card";
import { AdminSidePanel } from "./ui/admin-side-panel";

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

function sameItems(first: NavigationItems, second: NavigationItems) {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function NavigationEditor({ menus }: { menus: Record<NavigationLocation, NavigationDocument> }) {
  const { show: showToast } = useAdminToast();
  const [activeLocation, setActiveLocation] = useState<NavigationLocation>("header");
  const [documents, setDocuments] = useState(menus);
  const [savedDocuments, setSavedDocuments] = useState(menus);
  const [selectedKey, setSelectedKey] = useState<string | null>(menus.header.items[0]?.key ?? null);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentDocument = documents[activeLocation];
  const items = currentDocument.items;
  const selectedIndex = items.findIndex((item) => item.key === selectedKey);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;
  const dirty = !sameItems(items, savedDocuments[activeLocation].items);
  const hasUnsavedChanges = useMemo(
    () => locations.some((location) => !sameItems(documents[location].items, savedDocuments[location].items)),
    [documents, savedDocuments],
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const handleLink = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      event.preventDefault();
      showToast("Bạn có thay đổi menu chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi rời trang.", "warning");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLink, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLink, true);
    };
  }, [hasUnsavedChanges, showToast]);

  function updateItems(next: NavigationItems) {
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
    if (next === activeLocation) return;
    if (dirty) {
      showToast("Hãy lưu hoặc bỏ thay đổi ở menu hiện tại trước khi chuyển vị trí.", "warning");
      return;
    }
    setActiveLocation(next);
    setSelectedKey(documents[next].items[0]?.key ?? null);
    setPanelOpen(false);
  }

  function addItem(parentKey: string | null = null) {
    const entry: NavigationItems[number] = {
      key: createKey(),
      parentKey,
      label: "Mục menu mới",
      url: "/",
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
    setPanelOpen(true);
  }

  function removeSelected() {
    if (!selected) return;
    const keys = descendants(items, selected.key);
    const next = items.filter((item) => !keys.has(item.key));
    updateItems(next);
    setSelectedKey(selected.parentKey ?? next[0]?.key ?? null);
    setPanelOpen(Boolean(selected.parentKey ?? next[0]?.key));
    showToast("Đã loại mục và các mục con khỏi biểu mẫu. Lưu menu để áp dụng thay đổi.", "warning");
  }

  function closeEditor() {
    if (dirty) {
      showToast("Hãy lưu hoặc bỏ thay đổi menu trước khi đóng trình biên tập.", "warning");
      return;
    }
    setPanelOpen(false);
  }

  function discardChanges() {
    const saved = savedDocuments[activeLocation];
    setDocuments((current) => ({ ...current, [activeLocation]: saved }));
    setSelectedKey(saved.items[0]?.key ?? null);
    showToast("Đã bỏ các thay đổi chưa lưu.", "info");
  }

  async function save() {
    const parsed = navigationSchema.safeParse(items);
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message ?? "Dữ liệu menu chưa hợp lệ.", "error");
      return;
    }
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
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Không thể lưu menu.");
      const nextDocument = navigationDocumentSchema.parse(payload.menu);
      setDocuments((current) => ({ ...current, [activeLocation]: nextDocument }));
      setSavedDocuments((current) => ({ ...current, [activeLocation]: nextDocument }));
      setSelectedKey(nextDocument.items[selectedPosition]?.key ?? nextDocument.items[0]?.key ?? null);
      showToast("Đã cập nhật menu và lưu một phiên bản mới.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  const sidebar = <>
    <header className="border-b border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><Menu aria-hidden="true" size={18} /></span>
        <div><h1 className="text-base font-extrabold text-slate-950">Menu & Điều hướng</h1><p className="text-xs text-slate-500">Chọn vị trí, sau đó sửa từng mục.</p></div>
      </div>
      <div className="mt-4 grid gap-2" role="tablist" aria-label="Vị trí menu">
        {locations.map((location) => {
          const locationDirty = !sameItems(documents[location].items, savedDocuments[location].items);
          return <button
            aria-selected={activeLocation === location}
            className={activeLocation === location ? "flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-left text-sm font-bold text-blue-700" : "flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"}
            key={location}
            onClick={() => changeLocation(location)}
            role="tab"
            type="button"
          >
            <span>{locationLabel[location]}</span>
            <span className="text-xs">{locationDirty ? "Chưa lưu" : documents[location].items.length}</span>
          </button>;
        })}
      </div>
    </header>
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      <strong className="text-sm text-slate-950">Các mục ({items.length})</strong>
      <button className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800" onClick={() => addItem()} type="button"><Plus aria-hidden="true" size={14} />Thêm</button>
    </div>
    <div className="min-h-[calc(100dvh-22rem)] overflow-y-auto p-2">
      {items.map((item) => <button
        aria-current={selectedKey === item.key ? "true" : undefined}
        className={selectedKey === item.key ? "mb-1 flex w-full items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-left text-blue-700" : "mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50"}
        key={item.key}
        onClick={() => { setSelectedKey(item.key); setPanelOpen(true); }}
        style={{ paddingLeft: `${12 + Math.min(depth(items, item), 4) * 16}px` }}
        type="button"
      >
        {item.parentKey ? <CornerDownRight aria-hidden="true" className="shrink-0" size={14} /> : null}
        <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.label}</strong><small className="block truncate opacity-75">{item.url}</small></span>
        {!item.isEnabled ? <span className="text-[10px] font-bold uppercase">Ẩn</span> : null}
      </button>)}
      {items.length === 0 ? <AdminEmptyState action={<AdminButton onClick={() => addItem()}>Thêm mục đầu tiên</AdminButton>} description="Menu này chưa có mục nào." icon={<Menu aria-hidden="true" size={18} />} title="Menu trống" /> : null}
    </div>
  </>;

  const siblingPositions = selected ? siblingIndexes(items, selected.parentKey) : [];
  const siblingPosition = selectedIndex >= 0 ? siblingPositions.indexOf(selectedIndex) : -1;
  const possibleParents = selectedIndex > 0 ? items.slice(0, selectedIndex) : [];

  const editor = <>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 sm:px-5">
      <div><div className="flex items-center gap-2"><h2 className="text-lg font-extrabold text-slate-950">{locationLabel[activeLocation]}</h2><AdminStatusBadge tone={dirty ? "warning" : "success"}>{dirty ? "Chưa lưu" : `Phiên bản ${currentDocument.version}`}</AdminStatusBadge></div><p className="mt-1 text-sm text-slate-500">Mỗi lần lưu sẽ tạo một phiên bản có thể khôi phục.</p></div>
    </header>
    <div className="p-4 sm:p-5">
      {selected ? <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-slate-700">Nhãn hiển thị<input className="admin-input" maxLength={180} onChange={(event) => updateSelected({ label: event.target.value })} required value={selected.label} /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Đường dẫn<input className="admin-input" maxLength={1000} onChange={(event) => updateSelected({ url: event.target.value })} placeholder="/lien-he hoặc https://..." required value={selected.url} /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Mục cha<select className="admin-input" onChange={(event) => updateSelected({ parentKey: event.target.value || null })} value={selected.parentKey ?? ""}><option value="">Không có (mục cấp cao)</option>{possibleParents.map((parent) => <option key={parent.key} value={parent.key}>{"— ".repeat(depth(items, parent))}{parent.label}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Kiểu mở<select className="admin-input" onChange={(event) => updateSelected({ target: event.target.value as "_self" | "_blank" })} value={selected.target}><option value="_self">Cùng cửa sổ</option><option value="_blank">Cửa sổ mới</option></select></label>
        </div>
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"><input checked={selected.isEnabled} onChange={(event) => updateSelected({ isEnabled: event.target.checked })} type="checkbox" />Hiển thị mục này trên website</label>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
          <AdminButton disabled={siblingPosition <= 0} onClick={() => updateItems(moveSibling(items, selectedIndex, -1))} variant="secondary"><ChevronUp aria-hidden="true" size={16} />Lên</AdminButton>
          <AdminButton disabled={siblingPosition < 0 || siblingPosition >= siblingPositions.length - 1} onClick={() => updateItems(moveSibling(items, selectedIndex, 1))} variant="secondary"><ChevronDown aria-hidden="true" size={16} />Xuống</AdminButton>
          <AdminButton onClick={() => addItem(selected.key)} variant="secondary"><CornerDownRight aria-hidden="true" size={16} />Thêm mục con</AdminButton>
          <AdminButton className="ml-auto" onClick={removeSelected} variant="danger"><Trash2 aria-hidden="true" size={16} />Loại khỏi menu</AdminButton>
        </div>
      </div> : <AdminEmptyState action={<AdminButton onClick={() => addItem()}>Thêm mục menu</AdminButton>} description="Chọn một mục ở panel bên trái hoặc tạo mục mới." icon={<Menu aria-hidden="true" size={20} />} title="Chưa chọn mục" />}

      {currentDocument.id ? <details className="mt-6 border-t border-slate-200 pt-4"><summary className="cursor-pointer text-sm font-bold text-blue-700">Lịch sử và khôi phục</summary><RevisionHistory disabled={dirty} id={currentDocument.id} target="navigation" /></details> : null}
    </div>
  </>;

  const actions = <>{dirty ? <AdminButton onClick={discardChanges} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton> : null}<AdminButton disabled={busy || !dirty} onClick={save}><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : "Lưu menu"}</AdminButton></>;

  return <><AdminCard className="min-h-[calc(100dvh-7rem)] overflow-hidden">{sidebar}</AdminCard><AdminSidePanel footer={actions} isOpen={isPanelOpen} onClose={closeEditor}>{editor}</AdminSidePanel></>;
}
