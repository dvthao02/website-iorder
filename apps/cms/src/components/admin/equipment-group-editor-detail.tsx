"use client";

import { adminApiError } from "@/lib/admin-api";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { EquipmentGroupInput } from "@iorder/core/server/equipment/equipment.contract";
import { parseSavedEntityId } from "@/lib/admin-detail-payload";

import { MediaPicker } from "./media-picker";
import { AdminButton } from "./ui/admin-button";
import { AdminDetailPanel } from "./ui/admin-detail-panel";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminNotice, useAdminToast } from "./ui/admin-feedback";
import { useAdminPermissions } from "./ui/admin-permissions";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { createTransientDraftStore } from "./ui/transient-draft-store";

export type EquipmentGroupRecord = EquipmentGroupInput & { id: string; version: number };

const blankGroup: EquipmentGroupInput = { name: "", slug: "", description: null, coverMediaId: null, sortOrder: 0, isEnabled: true };
const groupDrafts = createTransientDraftStore<EquipmentGroupInput>();

function toForm(group?: EquipmentGroupRecord, canPublish = true): EquipmentGroupInput {
  return group ? { name: group.name, slug: group.slug, description: group.description, coverMediaId: group.coverMediaId, sortOrder: group.sortOrder, isEnabled: group.isEnabled } : { ...blankGroup, isEnabled: canPublish };
}

function Field({ children, label, hint }: { children: ReactNode; label: string; hint?: string }) {
  return <label className="admin-field"><span>{label}{hint ? <small className="ml-2 font-medium text-[var(--cms-muted)]">{hint}</small> : null}</span>{children}</label>;
}

export function EquipmentGroupEditorDetail({ group }: { group?: EquipmentGroupRecord }) {
  const router = useRouter();
  const canPublish = useAdminPermissions().can("equipment.publish");
  const draftKey = `${router.bfcacheId}:${group?.id ?? "new"}`;
  const serverBaseline = JSON.stringify(toForm(group, canPublish));
  const { show: showToast } = useAdminToast();
  const [form, setForm] = useState<EquipmentGroupInput>(() => groupDrafts.read(draftKey, serverBaseline) ?? toForm(group, canPublish));
  const [savedForm, setSavedForm] = useState<EquipmentGroupInput>(() => toForm(group, canPublish));
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  // Version vừa lưu nhớ cục bộ: props chỉ cập nhật sau router.refresh(), lưu liên tiếp không được gửi version cũ.
  const version = useRef(group?.version ?? 0);
  const groupVersion = group?.version;
  useEffect(() => { if (groupVersion !== undefined && groupVersion > version.current) version.current = groupVersion; }, [groupVersion]);
  const uploading = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const handleUploadingChange = useCallback((pending: boolean) => {
    uploading.current = pending;
    setIsUploading(pending);
  }, []);
  const processing = busy || isUploading;
  useNavigationGuard(processing, () => showToast("Đang xử lý nhóm thiết bị. Vui lòng chờ trước khi rời trang.", "info"));
  const [error, setError] = useState<string>();
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  useEffect(() => {
    if (dirty) groupDrafts.write(draftKey, serverBaseline, form);
    else groupDrafts.remove(draftKey);
  }, [draftKey, serverBaseline, form, dirty]);
  const title = group?.name ?? "Thêm nhóm thiết bị";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || uploading.current || !dirty) return;
    saving.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/admin/equipment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "groups", id: group?.id ?? null, values: form, ...(group ? { expectedVersion: version.current } : {}) }) });
      const payload = await response.json();
      if (!response.ok) throw adminApiError(payload, "Không thể lưu nhóm thiết bị.");
      const savedId = parseSavedEntityId(payload, group?.id);
      // Chỉ đánh dấu đúng bản đã gửi; thay đổi nhập thêm khi request đang chạy vẫn dirty.
      setSavedForm(form);
      if (group) version.current += 1;
      showToast(group ? "Đã lưu nhóm thiết bị." : "Đã tạo nhóm thiết bị.", "success");
      router.replace(`/admin/thiet-bi/nhom?edit=${savedId}`);
      router.refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không kết nối được máy chủ.";
      setError(message);
      showToast(message, "error");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <AdminDetailPanel backHref="/admin/thiet-bi?tab=groups" description={group ? "Cập nhật thông tin dùng để phân loại các thiết bị cùng nhóm." : "Tạo nhóm trước, sau đó thêm các thiết bị thuộc nhóm này."} eyebrow="Thiết bị · Nhóm thiết bị" hasUnsavedChanges={dirty} notice={error ? <AdminNotice tone="error">{error}</AdminNotice> : undefined} title={title}>
    <form className="grid gap-4" onSubmit={save}>
      <fieldset className="grid min-w-0 gap-4" disabled={processing}>
      <section className="admin-content-section">
        <header><h2>Thông tin nhóm</h2><p className="admin-help">Tên và đường dẫn công khai để khách hàng tìm thiết bị theo nhóm.</p></header>
        <div className="admin-form-grid">
          <Field label="Tên nhóm"><input onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} /></Field>
          <Field hint="chỉ chữ thường, số và dấu gạch ngang" label="Slug"><input onChange={(event) => setForm({ ...form, slug: event.target.value })} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={form.slug} /></Field>
        </div>
        <Field label="Mô tả"><textarea className="min-h-28" onChange={(event) => setForm({ ...form, description: event.target.value || null })} value={form.description ?? ""} /></Field>
      </section>
      <section className="admin-content-section">
        <header><h2>Hiển thị</h2><p className="admin-help">Kiểm soát vị trí và khả năng hiển thị trên website.</p></header>
        <div className="admin-form-grid"><Field label="Thứ tự hiển thị"><input min={0} onChange={(event) => setForm({ ...form, sortOrder: Math.max(0, Number(event.target.value) || 0) })} type="number" value={form.sortOrder} /></Field><label className="admin-check self-end"><input checked={form.isEnabled} disabled={!canPublish} onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })} type="checkbox" />Hiển thị nhóm trên website{canPublish ? null : <small className="font-medium text-[var(--cms-muted)]">Cần quyền xuất bản thiết bị</small>}</label></div>
      </section>
      <section className="admin-content-section"><header><h2>Ảnh bìa</h2><p className="admin-help">Ảnh đại diện cho nhóm thiết bị khi hiển thị trên website.</p></header><MediaPicker disabled={busy} onUploadingChange={handleUploadingChange} onChange={(coverMediaId) => setForm(current => ({ ...current, coverMediaId }))} value={form.coverMediaId} /></section>
      </fieldset>
      <AdminEditorActions><p role="status">{isUploading ? "Đang tải ảnh bìa…" : busy ? "Đang lưu nhóm thiết bị…" : dirty ? "Có thay đổi chưa lưu." : group ? "Không có thay đổi chưa lưu." : "Nhập thông tin để tạo nhóm thiết bị."}</p>{dirty ? <AdminButton disabled={processing} onClick={() => { if (saving.current || uploading.current) return; setForm(savedForm); setError(undefined); }} variant="secondary">Bỏ thay đổi</AdminButton> : null}<AdminButton disabled={processing || !dirty || (!canPublish && savedForm.isEnabled && Boolean(group))} permission={group ? "equipment.update" : "equipment.create"} title={!canPublish && savedForm.isEnabled && group ? "Nhóm đang hiển thị trên website; cần quyền xuất bản để sửa." : undefined} type="submit">{busy ? "Đang lưu…" : "Lưu nhóm thiết bị"}</AdminButton></AdminEditorActions>
    </form>
  </AdminDetailPanel>;
}
