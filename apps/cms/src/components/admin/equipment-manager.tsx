"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import type { EquipmentInput, EquipmentGroupInput } from "@iorder/core/server/equipment/equipment.contract";

import { MediaPicker } from "./media-picker";
import { PublishedPreviewLink } from "./published-preview-link";
import { RevisionHistory } from "./revision-history";
import { AdminEditorActions } from "./ui/admin-editor-actions";

export type EquipmentGroup = EquipmentGroupInput & { id: string };
export type EquipmentItem = EquipmentInput & { id: string; groupName: string; coverUrl: string | null; coverAlt: string | null; version: number; updatedAt: Date };
type Group = EquipmentGroup;
type Item = EquipmentItem;
type SpecificationGroup = EquipmentInput["specificationGroups"][number];

const blankGroup: EquipmentGroupInput = { name: "", slug: "", description: null, coverMediaId: null, sortOrder: 0, isEnabled: true };

function blankItem(groupId: string): EquipmentInput {
  return { groupId, name: "", slug: "", modelCode: null, coverMediaId: null, priceVnd: 0, warrantyMonths: 12, summary: null, specificationGroups: [], status: "draft", scheduledAt: null, sortOrder: 0, isFeatured: false, seoTitle: null, seoDescription: null, canonicalUrl: null };
}

function itemToForm(item: Item): EquipmentInput {
  return { groupId: item.groupId, name: item.name, slug: item.slug, modelCode: item.modelCode, coverMediaId: item.coverMediaId, priceVnd: item.priceVnd, warrantyMonths: item.warrantyMonths, summary: item.summary, specificationGroups: item.specificationGroups, status: item.status, scheduledAt: item.scheduledAt, sortOrder: item.sortOrder, isFeatured: item.isFeatured, seoTitle: item.seoTitle, seoDescription: item.seoDescription, canonicalUrl: item.canonicalUrl };
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const result = [...items];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

function ButtonRow({ index, length, onMove, onRemove }: { index: number; length: number; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  return <div className="flex flex-wrap gap-2"><button type="button" disabled={index === 0} onClick={() => onMove(-1)}>Lên</button><button type="button" disabled={index === length - 1} onClick={() => onMove(1)}>Xuống</button><button type="button" className="text-red-700" onClick={onRemove}>Xóa</button></div>;
}

function SpecificationGroupsEditor({ value, onChange }: { value: SpecificationGroup[]; onChange: (next: SpecificationGroup[]) => void }) {
  function updateGroup(index: number, group: SpecificationGroup) { onChange(value.map((entry, entryIndex) => entryIndex === index ? group : entry)); }
  return <section className="grid gap-4"><div><h3 className="text-lg font-bold">Thông số kỹ thuật</h3><p className="text-sm text-slate-600">Ví dụ: nhóm “Kết nối”, với các dòng “Cổng USB — 2 cổng”.</p></div>{value.map((group, groupIndex) => <fieldset className="grid gap-3 rounded border p-4" key={groupIndex}><legend className="px-1 font-semibold">Nhóm thông số {groupIndex + 1}</legend><label>Tên nhóm<input className="block w-full rounded border p-2" required value={group.title} onChange={event => updateGroup(groupIndex, { ...group, title: event.target.value })} /></label><div className="grid gap-3">{group.items.map((item, itemIndex) => <div className="grid gap-3 rounded bg-slate-50 p-3" key={itemIndex}><div className="grid gap-3 md:grid-cols-2"><label>Tên thông số<input className="block w-full rounded border p-2" required value={item.label} onChange={event => updateGroup(groupIndex, { ...group, items: group.items.map((entry, entryIndex) => entryIndex === itemIndex ? { ...entry, label: event.target.value } : entry) })} /></label><label>Giá trị<input className="block w-full rounded border p-2" required value={item.value} onChange={event => updateGroup(groupIndex, { ...group, items: group.items.map((entry, entryIndex) => entryIndex === itemIndex ? { ...entry, value: event.target.value } : entry) })} /></label></div><ButtonRow index={itemIndex} length={group.items.length} onMove={direction => updateGroup(groupIndex, { ...group, items: move(group.items, itemIndex, direction) })} onRemove={() => updateGroup(groupIndex, { ...group, items: group.items.filter((_, entryIndex) => entryIndex !== itemIndex) })} /></div>)}</div><button type="button" onClick={() => updateGroup(groupIndex, { ...group, items: [...group.items, { label: "Thông số mới", value: "" }] })}>Thêm thông số</button><ButtonRow index={groupIndex} length={value.length} onMove={direction => onChange(move(value, groupIndex, direction))} onRemove={() => onChange(value.filter((_, entryIndex) => entryIndex !== groupIndex))} /></fieldset>)}<button type="button" onClick={() => onChange([...value, { title: "Nhóm thông số mới", items: [] }])}>Thêm nhóm thông số</button></section>;
}

function GroupForm({ value, onChange }: { value: EquipmentGroupInput; onChange: (next: EquipmentGroupInput) => void }) {
  return <><label>Tên nhóm<input className="block w-full rounded border p-2" required value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} /></label><label>Slug<input className="block w-full rounded border p-2" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={value.slug} onChange={event => onChange({ ...value, slug: event.target.value })} /></label><label>Mô tả<textarea className="block w-full rounded border p-2" value={value.description ?? ""} onChange={event => onChange({ ...value, description: event.target.value.trim() || null })} /></label><label>Thứ tự<input className="block w-full rounded border p-2" type="number" min={0} value={value.sortOrder} onChange={event => onChange({ ...value, sortOrder: Math.max(0, Number(event.target.value) || 0) })} /></label><label className="flex gap-2"><input type="checkbox" checked={value.isEnabled} onChange={event => onChange({ ...value, isEnabled: event.target.checked })} />Hiển thị nhóm này trên website</label><MediaPicker value={value.coverMediaId} onChange={coverMediaId => onChange({ ...value, coverMediaId })} /></>;
}

function ItemForm({ value, groups, onChange }: { value: EquipmentInput; groups: Group[]; onChange: (next: EquipmentInput) => void }) {
  return <><label>Nhóm thiết bị<select className="block w-full rounded border p-2" required value={value.groupId} onChange={event => onChange({ ...value, groupId: event.target.value })}>{groups.map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><div className="grid gap-4 md:grid-cols-2"><label>Tên thiết bị<input className="block w-full rounded border p-2" required value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} /></label><label>Mã model<input className="block w-full rounded border p-2" value={value.modelCode ?? ""} onChange={event => onChange({ ...value, modelCode: event.target.value.trim() || null })} /></label></div><label>Slug<input className="block w-full rounded border p-2" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={value.slug} onChange={event => onChange({ ...value, slug: event.target.value })} /></label><div className="grid gap-4 md:grid-cols-2"><label>Giá (VNĐ)<input className="block w-full rounded border p-2" type="number" min={0} value={value.priceVnd} onChange={event => onChange({ ...value, priceVnd: Math.max(0, Number(event.target.value) || 0) })} /></label><label>Bảo hành (tháng)<input className="block w-full rounded border p-2" type="number" min={0} value={value.warrantyMonths} onChange={event => onChange({ ...value, warrantyMonths: Math.max(0, Number(event.target.value) || 0) })} /></label></div><label>Mô tả ngắn<textarea className="block w-full rounded border p-2" value={value.summary ?? ""} onChange={event => onChange({ ...value, summary: event.target.value.trim() || null })} /></label><div className="grid gap-4 md:grid-cols-2"><label>Trạng thái<select className="block w-full rounded border p-2" value={value.status} onChange={event => onChange({ ...value, status: event.target.value as EquipmentInput["status"] })}><option value="draft">Bản nháp</option><option value="review">Chờ duyệt</option><option value="scheduled">Hẹn giờ</option><option value="published">Xuất bản</option><option value="archived">Lưu trữ</option></select></label>{value.status === "scheduled" ? <label>Thời điểm hẹn giờ<input className="block w-full rounded border p-2" required type="datetime-local" value={value.scheduledAt ? new Date(value.scheduledAt).toISOString().slice(0, 16) : ""} onChange={event => onChange({ ...value, scheduledAt: event.target.value ? new Date(event.target.value) : null })} /></label> : null}<label>Thứ tự<input className="block w-full rounded border p-2" type="number" min={0} value={value.sortOrder} onChange={event => onChange({ ...value, sortOrder: Math.max(0, Number(event.target.value) || 0) })} /></label></div><label className="flex gap-2"><input type="checkbox" checked={value.isFeatured} onChange={event => onChange({ ...value, isFeatured: event.target.checked })} />Thiết bị nổi bật</label><MediaPicker value={value.coverMediaId} onChange={coverMediaId => onChange({ ...value, coverMediaId })} /><SpecificationGroupsEditor value={value.specificationGroups} onChange={specificationGroups => onChange({ ...value, specificationGroups })} /><fieldset className="grid gap-4 rounded border p-4"><legend className="px-1 font-semibold">SEO</legend><label>Tiêu đề SEO<input className="block w-full rounded border p-2" value={value.seoTitle ?? ""} onChange={event => onChange({ ...value, seoTitle: event.target.value.trim() || null })} /></label><label>Mô tả SEO<textarea className="block w-full rounded border p-2" value={value.seoDescription ?? ""} onChange={event => onChange({ ...value, seoDescription: event.target.value.trim() || null })} /></label><label>URL chuẩn<input className="block w-full rounded border p-2" type="url" value={value.canonicalUrl ?? ""} onChange={event => onChange({ ...value, canonicalUrl: event.target.value.trim() || null })} /></label></fieldset></>;
}

export function EquipmentManager({ groups, items, initialItemId, startCreatingItem = false, hideNavigation = false, hideEditorHeader = false }: { groups: Group[]; items: Item[]; initialItemId?: string; startCreatingItem?: boolean; hideNavigation?: boolean; hideEditorHeader?: boolean }) {
  const searchParams = useSearchParams();
  const requestedItem = items.find(item => item.id === (initialItemId ?? searchParams.get("edit")));
  const isCreating = startCreatingItem || searchParams.get("create") === "1";
  const shouldCreateItem = isCreating && groups.length > 0;
  const [kind, setKind] = useState<"groups" | "items">(requestedItem || shouldCreateItem ? "items" : "groups");
  const [id, setId] = useState<string | null>(requestedItem?.id ?? null);
  const [groupForm, setGroupForm] = useState<EquipmentGroupInput | null>(isCreating && !shouldCreateItem ? blankGroup : null);
  const [itemForm, setItemForm] = useState<EquipmentInput | null>(requestedItem ? itemToForm(requestedItem) : shouldCreateItem ? blankItem(groups[0].id) : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function select(nextKind: "groups" | "items", row?: Group | Item) {
    setKind(nextKind);
    setId(row?.id ?? null);
    setMessage("");
    if (nextKind === "groups") {
      const group = row as Group | undefined;
      setGroupForm(group ? { name: group.name, slug: group.slug, description: group.description, coverMediaId: group.coverMediaId, sortOrder: group.sortOrder, isEnabled: group.isEnabled } : blankGroup);
      setItemForm(null);
      return;
    }
    const item = row as Item | undefined;
    setItemForm(item ? itemToForm(item) : blankItem(groups[0]?.id ?? ""));
    setGroupForm(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = kind === "groups" ? groupForm : itemForm;
    if (!values) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/equipment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id, values }) });
      const payload = await response.json();
      if (response.ok) window.location.reload();
      else setMessage(payload.error?.message || "Không thể lưu thiết bị.");
    } catch {
      setMessage("Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
    }
  }

  const form = kind === "groups" ? groupForm : itemForm;
  const selectedItem = kind === "items" && id ? items.find(item => item.id === id) : undefined;
  return <div className={`grid gap-6 ${hideNavigation ? "md:grid-cols-1" : "md:grid-cols-[260px_1fr]"}`}><aside className={hideNavigation ? "hidden" : "grid content-start gap-3"}><button type="button" onClick={() => select("groups")}>Thêm nhóm thiết bị</button><button type="button" onClick={() => select("items")} disabled={!groups.length}>Thêm thiết bị</button><h2 className="font-bold">Nhóm thiết bị</h2>{groups.map(row => <button type="button" key={row.id} onClick={() => select("groups", row)}>{row.name}</button>)}<h2 className="font-bold">Thiết bị</h2>{items.map(row => <button type="button" key={row.id} onClick={() => select("items", row)}>{row.name}</button>)}</aside>{form ? <form onSubmit={save} className="grid gap-4">{!hideEditorHeader ? <><h2>{id ? "Chỉnh sửa" : "Tạo mới"} {kind === "groups" ? "nhóm thiết bị" : "thiết bị"}</h2>{selectedItem ? <PublishedPreviewLink kind="equipment" slug={selectedItem.slug} status={selectedItem.status} /> : null}</> : null}{kind === "groups" && groupForm ? <GroupForm value={groupForm} onChange={setGroupForm} /> : null}{kind === "items" && itemForm ? <ItemForm value={itemForm} groups={groups} onChange={setItemForm} /> : null}{kind === "items" && id ? <RevisionHistory target="equipment" id={id} /> : null}<AdminEditorActions><p role="status">{message}</p><button disabled={busy} className="rounded bg-blue-700 p-3 text-white disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></AdminEditorActions></form> : <p>Chọn nhóm hoặc thiết bị để chỉnh sửa. Tạo nhóm trước khi thêm thiết bị.</p>}</div>;
}
