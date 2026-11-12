"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { equipmentGroupInputSchema, type EquipmentGroupInput } from "@iorder/shared/server/equipment/equipment.contract";
import { parseSavedEntityId } from "@/lib/admin-detail-payload";
import { toSlug } from "@/lib/slug";

import { MediaPicker } from "./media-picker";
import { AdminButton } from "./ui/admin-button";
import { AdminDetailPanel } from "./ui/admin-detail-panel";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminNotice, useAdminToast } from "./ui/admin-feedback";
import { useAdminPermissions } from "./ui/admin-permissions";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { createTransientDraftStore } from "./ui/transient-draft-store";
import { AdminFormField } from "./ui/admin-form-field";
import { useAdminFormValidation } from "./ui/use-admin-form-validation";

export type EquipmentGroupRecord = EquipmentGroupInput & { id: string; version: number };

const blankGroup: EquipmentGroupInput = { name: "", slug: "", description: null, coverMediaId: null, sortOrder: 0, isEnabled: true };
const groupDrafts = createTransientDraftStore<EquipmentGroupInput>();

function toForm(group?: EquipmentGroupRecord, canPublish = true): EquipmentGroupInput {
  return group ? { name: group.name, slug: group.slug, description: group.description, coverMediaId: group.coverMediaId, sortOrder: group.sortOrder, isEnabled: group.isEnabled } : { ...blankGroup, isEnabled: canPublish };
}

export function EquipmentGroupEditorDetail({ group }: { group?: EquipmentGroupRecord }) {
  const router = useRouter();
  const { can } = useAdminPermissions();
  const canPublish = can("equipment.publish");
  const [entityId, setEntityId] = useState(group?.id);
  const canEdit = can(entityId ? "equipment.update" : "equipment.create") && (canPublish || !group?.isEnabled);
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
  const [slugTouched, setSlugTouched] = useState(() => Boolean(group || groupDrafts.read(draftKey, serverBaseline)?.slug));
  const validation = useAdminFormValidation("equipment-group", {
    name: { label: "Tên nhóm", message: "Nhập tên nhóm từ 1 đến 180 ký tự." },
    slug: { label: "Đường dẫn", message: "Nhập đường dẫn tối đa 180 ký tự, chỉ gồm chữ thường không dấu, số và dấu gạch ngang." },
    description: { label: "Mô tả", message: "Mô tả không được vượt quá 10.000 ký tự." },
    sortOrder: { label: "Thứ tự hiển thị", message: "Nhập số nguyên từ 0 đến 10.000." },
    coverMediaId: { label: "Ảnh bìa", message: "Chọn lại ảnh bìa từ thư viện." },
    isEnabled: { label: "Hiển thị", message: "Chọn trạng thái hiển thị hợp lệ." },
  });
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  useEffect(() => {
    if (dirty) groupDrafts.write(draftKey, serverBaseline, form);
    else groupDrafts.remove(draftKey);
  }, [draftKey, serverBaseline, form, dirty]);
  const title = group?.name ?? "Thêm nhóm thiết bị";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || uploading.current || !dirty || !canEdit) return;
    setError(undefined);
    const parsed = equipmentGroupInputSchema.safeParse(form);
    if (!parsed.success) { validation.report(parsed.error.issues); return; }
    validation.reset();
    saving.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/v1/admin/equipment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "groups", id: entityId ?? null, values: parsed.data, ...(entityId ? { expectedVersion: version.current } : {}) }) });
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không thể lưu nhóm thiết bị.");
      const savedId = parseSavedEntityId(payload, entityId);
      // Chỉ đánh dấu đúng bản đã gửi; thay đổi nhập thêm khi request đang chạy vẫn dirty.
      setForm(parsed.data);
      setSavedForm(parsed.data);
      if (entityId) version.current += 1;
      setEntityId(savedId);
      setSlugTouched(true);
      showToast(entityId ? "Đã lưu nhóm thiết bị." : "Đã tạo nhóm thiết bị.", "success");
      router.replace(`/admin/equipment/groups?edit=${savedId}`);
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

  return <AdminDetailPanel backHref="/admin/equipment?tab=groups" description={group ? "Cập nhật thông tin dùng để phân loại các thiết bị cùng nhóm." : "Tạo nhóm trước, sau đó thêm các thiết bị thuộc nhóm này."} eyebrow="Thiết bị · Nhóm thiết bị" hasUnsavedChanges={dirty} notice={error ? <AdminNotice tone="error">{error}</AdminNotice> : undefined} title={title}>
    <form className="grid gap-4" noValidate onSubmit={save}>
      {!canEdit ? <AdminNotice tone="info">{group?.isEnabled && !canPublish ? "Nhóm đang hiển thị trên website. Bạn cần quyền xuất bản thiết bị để sửa nhóm này." : "Bạn chỉ có quyền xem nhóm thiết bị này."}</AdminNotice> : null}
      {validation.summary}
      <fieldset className="grid min-w-0 gap-4" disabled={processing || !canEdit}>
      <section className="admin-content-section">
        <header><h2>Thông tin nhóm</h2><p className="admin-help">Tên và đường dẫn công khai để khách hàng tìm thiết bị theo nhóm.</p></header>
        <div className="admin-form-grid">
          <AdminFormField id={validation.props("name").id} label="Tên nhóm" error={validation.message("name")}><input {...validation.props("name")} onChange={(event) => { const name = event.target.value; setForm(current => ({ ...current, name, ...(slugTouched ? {} : { slug: toSlug(name, 180) }) })); }} required value={form.name} /></AdminFormField>
          <AdminFormField id={validation.props("slug").id} hint="Tự tạo theo tên cho tới khi bạn sửa. Chỉ dùng chữ thường không dấu, số và dấu gạch ngang." label="Đường dẫn" error={validation.message("slug")}><input {...validation.props("slug")} onChange={(event) => { setSlugTouched(true); setForm({ ...form, slug: event.target.value }); }} required value={form.slug} /></AdminFormField>
        </div>
        <AdminFormField id={validation.props("description").id} label="Mô tả" error={validation.message("description")}><textarea {...validation.props("description")} className="min-h-28" onChange={(event) => setForm({ ...form, description: event.target.value || null })} value={form.description ?? ""} /></AdminFormField>
      </section>
      <section className="admin-content-section">
        <header><h2>Hiển thị</h2><p className="admin-help">Kiểm soát vị trí và khả năng hiển thị trên website.</p></header>
        <div className="admin-form-grid"><AdminFormField id={validation.props("sortOrder").id} label="Thứ tự hiển thị" error={validation.message("sortOrder")}><input {...validation.props("sortOrder")} min={0} max={10000} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} type="number" value={form.sortOrder} /></AdminFormField><label className="admin-check self-end"><input checked={form.isEnabled} disabled={!canPublish} onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })} type="checkbox" />Hiển thị nhóm trên website{canPublish ? null : <small className="font-medium text-[var(--cms-muted)]">Cần quyền xuất bản thiết bị</small>}</label></div>
      </section>
      <section className="admin-content-section"><header><h2>Ảnh bìa</h2><p className="admin-help">Ảnh đại diện cho nhóm thiết bị khi hiển thị trên website.</p></header><div {...validation.props("coverMediaId")} tabIndex={-1}><MediaPicker compact disabled={busy || !canEdit} label="Ảnh bìa" onUploadingChange={handleUploadingChange} onChange={(coverMediaId) => setForm(current => ({ ...current, coverMediaId }))} value={form.coverMediaId} /></div>{validation.message("coverMediaId")}</section>
      </fieldset>
      <AdminEditorActions><p role="status">{isUploading ? "Đang tải ảnh bìa…" : busy ? "Đang lưu nhóm thiết bị…" : dirty ? "Có thay đổi chưa lưu." : entityId ? "Không có thay đổi chưa lưu." : "Nhập thông tin để tạo nhóm thiết bị."}</p>{dirty ? <AdminButton disabled={processing} onClick={() => { if (saving.current || uploading.current) return; setForm(savedForm); setSlugTouched(Boolean(entityId)); setError(undefined); validation.reset(); }} variant="secondary">Bỏ thay đổi</AdminButton> : null}<AdminButton disabled={processing || !dirty || !canEdit} permission={entityId ? "equipment.update" : "equipment.create"} type="submit">{busy ? "Đang lưu…" : "Lưu nhóm thiết bị"}</AdminButton></AdminEditorActions>
    </form>
  </AdminDetailPanel>;
}
