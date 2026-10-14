"use client";

import { ChevronDown, ChevronUp, CornerDownRight, Link2, Menu, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

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
import { AdminSidePanel } from "./ui/admin-side-panel";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useRevisionRestore } from "./ui/use-revision-restore";

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

export function NavigationEditor({ menus, targets }: { menus: Record<NavigationLocation, NavigationDocument>; targets: NavigationTarget[] }) {
  const { show: showToast } = useAdminToast();
  const [activeLocation, setActiveLocation] = useState<NavigationLocation>("header");
  const [documents, setDocuments] = useState(menus);
  const [savedDocuments, setSavedDocuments] = useState(menus);
  const [selectedKey, setSelectedKey] = useState<string | null>(menus.header.items[0]?.key ?? null);
  const [isPanelOpen, setPanelOpen] = useState(false);
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
    setPanelOpen(false);
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
    setPanelOpen(true);
  }

  function removeSelected() {
    if (saving.current || revisionRestore.pending.current) return;
    if (!selected) return;
    const keys = descendants(items, selected.key);
    const next = items.filter((item) => !keys.has(item.key));
    updateItems(next);
    setSelectedKey(selected.parentKey ?? next[0]?.key ?? null);
    setPanelOpen(Boolean(selected.parentKey ?? next[0]?.key));
    showToast("Đã loại mục và các mục con khỏi biểu mẫu. Lưu menu để áp dụng thay đổi.", "warning");
  }

  function closeEditor() {
    if (saving.current || revisionRestore.pending.current) { showToast("Đang xử lý menu. Vui lòng chờ trước khi đóng.", "info"); return; }
    if (dirty) {
      showToast("Menu chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi đóng.", "warning");
      return;
    }
    setPanelOpen(false);
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
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Không thể lưu menu.");
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

  const sidebar = <>
    <header className="grid gap-4 border-b border-[var(--cms-border)] p-4">
      <AdminListHeader actions={<AdminButton disabled={busy} leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => addItem()}>Thêm mục</AdminButton>} description="Chọn vị trí, sau đó sửa từng mục." headingLevel={1} title="Menu & Điều hướng" />
      <AdminFilterTabs ariaLabel="Vị trí menu" disabled={busy} items={locations.map((location) => ({ label: `${locationLabel[location]} · ${!sameItems(documents[location].items, savedDocuments[location].items) ? "chưa lưu" : documents[location].items.length}`, value: location }))} onValueChange={changeLocation} value={activeLocation} />
    </header>
    <div className="flex items-center justify-between border-b border-[var(--cms-border)] px-4 py-3">
      <strong className="text-sm text-[var(--cms-text)]">Các mục ({items.length})</strong>
      <button disabled={busy} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800" onClick={() => addItem()} type="button"><Plus aria-hidden="true" size={14} />Thêm</button>
    </div>
    <div className="min-h-[calc(100dvh-22rem)] overflow-y-auto p-2">
      {items.map((item) => <button
        aria-current={selectedKey === item.key ? "true" : undefined}
        className={selectedKey === item.key ? "mb-1 flex w-full items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-left text-blue-700" : "mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[var(--cms-text)] hover:bg-[var(--cms-hover)]"}
        key={item.key}
        disabled={busy}
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
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cms-border)] p-4 sm:px-5">
      <div><div className="flex items-center gap-2"><h2 className="text-lg font-extrabold text-[var(--cms-text)]">{locationLabel[activeLocation]}</h2><AdminStatusBadge tone={dirty ? "warning" : "success"}>{dirty ? "Chưa lưu" : `Phiên bản ${currentDocument.version}`}</AdminStatusBadge></div><p className="mt-1 text-sm text-[var(--cms-muted)]">Mỗi lần lưu sẽ tạo một phiên bản có thể khôi phục.</p></div>
    </header>
    <fieldset disabled={busy} className="min-w-0 border-0 p-4 sm:p-5">
      {selected ? <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-[var(--cms-text)]">Nhãn hiển thị<input className="admin-input" maxLength={180} onChange={(event) => updateSelected({ label: event.target.value })} required value={selected.label} /></label>
          <label className="grid gap-2 text-sm font-bold text-[var(--cms-text)]">Loại liên kết<select className="admin-input" onChange={(event) => {
            updateSelected(event.target.value === "custom" ? { linkType: "custom", contentId: null } : { linkType: "page", contentId: null });
          }} value={selected.linkType === "custom" ? "custom" : "published"}>
            <option value="published">Nội dung đã xuất bản</option><option value="custom">URL tùy chỉnh</option>
          </select></label>
          {selected.linkType === "custom" ? <label className="grid gap-2 text-sm font-bold text-[var(--cms-text)] md:col-span-2">Đường dẫn<input className="admin-input" maxLength={1000} onChange={(event) => updateSelected({ url: event.target.value })} placeholder="/lien-he hoặc https://..." required value={selected.url} /></label> : <label className="grid gap-2 text-sm font-bold text-[var(--cms-text)] md:col-span-2">Nội dung đã xuất bản<select className="admin-input" onChange={(event) => selectPublishedTarget(event.target.value)} value={selected.contentId ? `${selected.linkType}:${selected.contentId}` : ""}><option value="">Chọn nội dung đã xuất bản</option>{targets.map((target) => <option key={`${target.linkType}:${target.id}`} value={`${target.linkType}:${target.id}`}>{target.typeLabel} — {target.label} ({target.url})</option>)}</select><span className="text-xs font-medium text-[var(--cms-muted)]">URL sẽ tự cập nhật khi slug của nội dung thay đổi; nội dung bị gỡ publish sẽ tự ẩn khỏi website.</span></label>}
          <label className="grid gap-2 text-sm font-bold text-[var(--cms-text)]">Mục cha<select className="admin-input" onChange={(event) => updateSelected({ parentKey: event.target.value || null })} value={selected.parentKey ?? ""}><option value="">Không có (mục cấp cao)</option>{possibleParents.map((parent) => <option key={parent.key} value={parent.key}>{"— ".repeat(depth(items, parent))}{parent.label}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold text-[var(--cms-text)]">Kiểu mở<select className="admin-input" onChange={(event) => updateSelected({ target: event.target.value as "_self" | "_blank" })} value={selected.target}><option value="_self">Cùng cửa sổ</option><option value="_blank">Cửa sổ mới</option></select></label>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-[var(--cms-text)]"><Link2 aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={17} /><p>{selected.linkType === "custom" ? "URL tùy chỉnh được giữ nguyên theo cấu hình menu." : "Mục này đang liên kết trực tiếp tới nội dung publish; CMS sẽ dùng URL thực tế của nội dung đó."}</p></div>
        <label className="flex items-center gap-3 rounded-lg border border-[var(--cms-border)] px-4 py-3 text-sm font-bold text-[var(--cms-text)]"><input checked={selected.isEnabled} onChange={(event) => updateSelected({ isEnabled: event.target.checked })} type="checkbox" />Hiển thị mục này trên website</label>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--cms-border)] pt-4">
          <AdminButton disabled={siblingPosition <= 0} onClick={() => updateItems(moveSibling(items, selectedIndex, -1))} variant="secondary"><ChevronUp aria-hidden="true" size={16} />Lên</AdminButton>
          <AdminButton disabled={siblingPosition < 0 || siblingPosition >= siblingPositions.length - 1} onClick={() => updateItems(moveSibling(items, selectedIndex, 1))} variant="secondary"><ChevronDown aria-hidden="true" size={16} />Xuống</AdminButton>
          <AdminButton onClick={() => addItem(selected.key)} variant="secondary"><CornerDownRight aria-hidden="true" size={16} />Thêm mục con</AdminButton>
          <AdminButton className="ml-auto" onClick={removeSelected} variant="danger"><Trash2 aria-hidden="true" size={16} />Loại khỏi menu</AdminButton>
        </div>
      </div> : <AdminEmptyState action={<AdminButton onClick={() => addItem()}>Thêm mục menu</AdminButton>} description="Chọn một mục ở panel bên trái hoặc tạo mục mới." icon={<Menu aria-hidden="true" size={20} />} title="Chưa chọn mục" />}

      {currentDocument.id ? <details className="mt-6 border-t border-[var(--cms-border)] pt-4"><summary className="cursor-pointer text-sm font-bold text-blue-700">Lịch sử và khôi phục</summary><RevisionHistory disabled={dirty || busy} expectedVersion={currentDocument.version} id={currentDocument.id} target="navigation" onRestorePendingChange={revisionRestore.onPendingChange} onRestored={revisionRestore.onRestored} /></details> : null}
    </fieldset>
  </>;

  const actions = <>{dirty ? <AdminButton disabled={busy} onClick={discardChanges} variant="secondary"><RotateCcw aria-hidden="true" size={16} />Bỏ thay đổi</AdminButton> : null}<AdminButton disabled={busy || !dirty} onClick={save}><Save aria-hidden="true" size={16} />{busy ? "Đang lưu…" : "Lưu menu"}</AdminButton></>;

  return <><AdminCard className="min-h-[calc(100dvh-7rem)] overflow-hidden">{sidebar}</AdminCard><AdminSidePanel footer={actions} isOpen={isPanelOpen} onClose={closeEditor}>{editor}</AdminSidePanel></>;
}
