"use client";
import { CmsPageBuilder } from "./cms-page-builder";
import { ContentSeoEditor } from "./content-seo-editor";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import type { EquipmentGroupInput, EquipmentInput } from "@iorder/core/server/equipment/equipment.contract";
import { seoChecks } from "@iorder/core/server/shared/seo";
import { adminApiError, readAdminJson, requestAdminJson } from "@/lib/admin-api";
import { parseSavedEntityId, parseSavedEntityVersion } from "@/lib/admin-detail-payload";
import { formatLocalDateTime } from "@/lib/local-date-time";
import { toSlug } from "@/lib/slug";

import { MediaPicker } from "./media-picker";
import { PublishedPreviewLink } from "./published-preview-link";
import { RevisionHistory } from "./revision-history";
import { AdminButton } from "./ui/admin-button";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminEditorSection } from "./ui/admin-editor-section";
import { AdminNotice, AdminStatusBadge } from "./ui/admin-feedback";
import { AdminInlineCreate } from "./ui/admin-inline-create";
import { AdminListRowControls, moveListItem } from "./ui/admin-list-editor";
import { useAdminPermissions } from "./ui/admin-permissions";
import { ContentStatusChoice, PrepublishHints, contentStatusBadge, contentSubmitLabel } from "./ui/content-status-choice";
import { SeoAssistant } from "./ui/seo-assistant";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";

export type EquipmentGroup = EquipmentGroupInput & { id: string; version: number };
export type EquipmentItem = EquipmentInput & { id: string; groupName: string; coverUrl: string | null; coverAlt: string | null; version: number; updatedAt: Date };
type SpecificationGroup = EquipmentInput["specificationGroups"][number];

const blankGroup: EquipmentGroupInput = { name: "", slug: "", description: null, coverMediaId: null, sortOrder: 0, isEnabled: true };
const priceFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const noun = "thiết bị";

function blankItem(groupId: string): EquipmentInput {
  return { groupId, name: "", slug: "", modelCode: null, coverMediaId: null, priceVnd: 0, warrantyMonths: 12, summary: null, specificationGroups: [], status: "draft", scheduledAt: null, sortOrder: 0, isFeatured: false, seoTitle: null, seoDescription: null, canonicalUrl: null, seo: {}, blocks: [] };
}

function itemToForm(item: EquipmentItem): EquipmentInput {
  return { groupId: item.groupId, name: item.name, slug: item.slug, modelCode: item.modelCode, coverMediaId: item.coverMediaId, priceVnd: item.priceVnd, warrantyMonths: item.warrantyMonths, summary: item.summary, specificationGroups: item.specificationGroups, status: item.status, scheduledAt: item.scheduledAt, sortOrder: item.sortOrder, isFeatured: item.isFeatured, seoTitle: item.seoTitle, seoDescription: item.seoDescription, canonicalUrl: item.canonicalUrl, seo: item.seo ?? {}, blocks: item.blocks ?? [] };
}

// Thông số theo nhóm (ví dụ "Kết nối" → "Cổng USB: 2 cổng"); website hiện thành bảng theo từng nhóm.
function SpecificationGroupsEditor({ value, onChange }: { value: SpecificationGroup[]; onChange: (next: SpecificationGroup[]) => void }) {
  function updateGroup(index: number, group: SpecificationGroup) { onChange(value.map((entry, entryIndex) => entryIndex === index ? group : entry)); }
  return <div className="admin-list-editor">
    {value.map((group, groupIndex) => <fieldset className="admin-spec-group" key={groupIndex}>
      <legend className="sr-only">Nhóm thông số {groupIndex + 1}</legend>
      <div className="admin-spec-group__head">
        <input aria-label={`Tên nhóm thông số ${groupIndex + 1}`} className="admin-input admin-spec-group__title" maxLength={180} onChange={event => updateGroup(groupIndex, { ...group, title: event.target.value })} placeholder="Tên nhóm, ví dụ: Kết nối" required value={group.title} />
        <AdminListRowControls index={groupIndex} label={`nhóm thông số ${groupIndex + 1}`} length={value.length} onMove={direction => onChange(moveListItem(value, groupIndex, direction))} onRemove={() => onChange(value.filter((_, entryIndex) => entryIndex !== groupIndex))} />
      </div>
      {group.items.length ? <ol className="admin-list-editor__rows">{group.items.map((item, itemIndex) => <li className="admin-list-editor__row" key={itemIndex}>
        <span aria-hidden="true" className="admin-list-editor__index">{itemIndex + 1}</span>
        <span className="admin-spec-group__pair">
          <input aria-label={`Tên thông số ${itemIndex + 1} của nhóm ${groupIndex + 1}`} className="admin-input" maxLength={180} onChange={event => updateGroup(groupIndex, { ...group, items: group.items.map((entry, entryIndex) => entryIndex === itemIndex ? { ...entry, label: event.target.value } : entry) })} placeholder="Tên thông số" required value={item.label} />
          <input aria-label={`Giá trị thông số ${itemIndex + 1} của nhóm ${groupIndex + 1}`} className="admin-input" maxLength={2000} onChange={event => updateGroup(groupIndex, { ...group, items: group.items.map((entry, entryIndex) => entryIndex === itemIndex ? { ...entry, value: event.target.value } : entry) })} placeholder="Giá trị" required value={item.value} />
        </span>
        <AdminListRowControls index={itemIndex} label={`thông số ${itemIndex + 1}`} length={group.items.length} onMove={direction => updateGroup(groupIndex, { ...group, items: moveListItem(group.items, itemIndex, direction) })} onRemove={() => updateGroup(groupIndex, { ...group, items: group.items.filter((_, entryIndex) => entryIndex !== itemIndex) })} />
      </li>)}</ol> : <p className="admin-help">Nhóm chưa có thông số.</p>}
      <AdminButton className="justify-self-start" disabled={group.items.length >= 100} leadingIcon={<Plus aria-hidden="true" size={15} />} onClick={() => updateGroup(groupIndex, { ...group, items: [...group.items, { label: "", value: "" }] })} size="sm" variant="ghost">Thêm thông số</AdminButton>
    </fieldset>)}
    <AdminButton className="justify-self-start" disabled={value.length >= 50} leadingIcon={<Plus aria-hidden="true" size={15} />} onClick={() => onChange([...value, { title: "", items: [{ label: "", value: "" }] }])} size="sm" variant="secondary">Thêm nhóm thông số</AdminButton>
  </div>;
}

export function EquipmentEditor({ groups, item, onDirtyChange, onError, onSaved }: { groups: EquipmentGroup[]; item?: EquipmentItem; onDirtyChange?: (dirty: boolean) => void; onError: (message: string) => void; onSaved: (savedId: string, created: boolean, status: EquipmentInput["status"]) => void }) {
  const { can } = useAdminPermissions();
  const canPublish = can("equipment.publish");
  const [form, setForm] = useState<EquipmentInput>(() => item ? itemToForm(item) : blankItem(groups[0]?.id ?? ""));
  const [id, setId] = useState<string | null>(item?.id ?? null);
  const [version, setVersion] = useState<number | undefined>(item?.version);
  const [savedStatus, setSavedStatus] = useState(item?.status);
  const canEdit = can(id ? "equipment.update" : "equipment.create") && (canPublish || !["published", "scheduled"].includes(savedStatus ?? "draft"));
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const uploading = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const handleUploadingChange = useCallback((pending: boolean) => {
    uploading.current = pending;
    setIsUploading(pending);
  }, []);
  const processing = isSaving || isUploading;
  useNavigationGuard(processing, () => onError("Đang xử lý thiết bị. Vui lòng chờ trước khi rời trang."));
  const { isDirty, markSaved } = useUnsavedChanges(form);
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(item));
  const [historyOpen, setHistoryOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Ctrl+S / ⌘+S lưu ngay, không phải cuộn xuống thanh lưu.
  useEffect(() => {
    function save(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); formRef.current?.requestSubmit(); }
    }
    window.addEventListener("keydown", save);
    return () => window.removeEventListener("keydown", save);
  }, []);

  function update<Field extends keyof EquipmentInput>(field: Field, value: EquipmentInput[Field]) {
    if (!canEdit || saving.current) return;
    setForm((current) => ({ ...current, [field]: value }));
  }
  function changeName(name: string) {
    if (!canEdit || saving.current) return;
    setForm((current) => ({ ...current, name, ...(slugTouched ? {} : { slug: toSlug(name, 80) }) }));
  }

  // Nhóm vừa tạo ngay trong form: hiện luôn trong danh sách và được chọn sẵn.
  const [createdGroups, setCreatedGroups] = useState<EquipmentGroup[]>([]);
  const allGroups = [...groups, ...createdGroups.filter((group) => !groups.some((existing) => existing.id === group.id))];
  async function createGroup(name: string, slug: string) {
    const values: EquipmentGroupInput = { ...blankGroup, name, slug, isEnabled: canPublish };
    const payload = await requestAdminJson("/api/admin/equipment", "POST", { kind: "groups", id: null, values }, "Không thể tạo nhóm thiết bị.");
    const groupId = parseSavedEntityId(payload, undefined);
    setCreatedGroups((current) => [...current, { id: groupId, version: 0, ...values }]);
    setForm((current) => ({ ...current, groupId }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || saving.current || uploading.current) return;
    saving.current = true;
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/equipment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "items", id, values: form, ...(id ? { expectedVersion: version } : {}) }) });
      const payload = await readAdminJson(response);
      if (!response.ok) throw new Error(adminApiError(payload, "Không thể lưu thiết bị.").message);
      const savedId = parseSavedEntityId(payload, id ?? undefined);
      setVersion(parseSavedEntityVersion(payload, id ? (version ?? NaN) + 1 : 1));
      setId(savedId);
      setSavedStatus(form.status);
      markSaved();
      onSaved(savedId, !id, form.status);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Không kết nối được máy chủ.");
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  const summary = form.summary ?? "";
  const publicPath = `/thiet-bi/${form.slug || "duong-dan"}`;
  const seoContent = { blocks: [{ type: "paragraph", text: summary }] };
  const checks = seoChecks({ title: form.name, seoTitle: form.seoTitle ?? "", seoDescription: form.seoDescription ?? "", excerpt: summary, slug: form.slug, hasCover: Boolean(form.coverMediaId), content: seoContent });
  const seoPassed = checks.filter((check) => check.ok).length;
  const goingLive = form.status === "published" || form.status === "scheduled";
  const missing = [
    !form.coverMediaId ? { id: "equipment-cover", label: "Ảnh bìa" } : null,
    !summary.trim() ? { id: "equipment-summary", label: "Mô tả ngắn" } : null,
    !form.specificationGroups.some((group) => group.items.length) ? { id: "equipment-specs", label: "Thông số kỹ thuật" } : null,
    form.priceVnd === 0 ? { id: "equipment-price", label: "Giá bán (đang là 0 ₫)" } : null,
  ].filter((entry): entry is { id: string; label: string } => entry !== null);

  return (
    <form className="admin-post-editor" onSubmit={submit} ref={formRef}>
      {!canEdit ? <div className="col-span-full"><AdminNotice tone="info">Bạn chỉ có quyền xem nội dung này. Nội dung đang hiển thị cần thêm quyền xuất bản để sửa.</AdminNotice></div> : null}
      <fieldset disabled={processing} className="contents">
      <div className="admin-post-editor__main">
        <AdminEditorSection className="admin-post-editor__writing" description="Tên, giá và mô tả ngắn để khách hàng nhận diện thiết bị." id="equipment-basic" step={1} title="Thông tin cơ bản">
          <label className="admin-post-editor__title-field"><span className="sr-only">Tên thiết bị</span><input className="admin-post-editor__title" maxLength={220} onChange={(event) => changeName(event.target.value)} placeholder="Nhập tên thiết bị…" required value={form.name} /></label>
          {editingSlug ? <div className="admin-post-editor__slug-edit">
            <div className="admin-field"><label className="admin-seo__label" htmlFor="equipment-slug">Đường dẫn<span className="admin-help">Địa chỉ không dấu trên website: {publicPath}</span></label><span className="admin-post-editor__slug"><input autoFocus className="admin-input" id="equipment-slug" maxLength={180} onChange={(event) => { setSlugTouched(true); update("slug", event.target.value); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={form.slug} /><AdminButton disabled={!form.name.trim() || toSlug(form.name, 80) === form.slug} onClick={() => { setSlugTouched(true); update("slug", toSlug(form.name, 80)); }} size="sm" variant="secondary">Tạo từ tên</AdminButton><AdminButton onClick={() => setEditingSlug(false)} size="sm" variant="ghost">Xong</AdminButton></span></div>
            {savedStatus === "published" && form.status === "published" ? <small className="admin-help">Thiết bị đang hiển thị: khi lưu với đường dẫn mới, đường dẫn cũ tự chuyển hướng (301) sang đường dẫn mới.</small> : savedStatus === "published" ? <small className="admin-help admin-text-warning">Sau lần lưu này nội dung chưa hiện ngay trên website nên đổi đường dẫn sẽ không tạo chuyển hướng từ đường dẫn cũ.</small> : <small className="admin-help">Chỉ dùng chữ thường không dấu, số và dấu gạch ngang.</small>}
          </div> : <p className="admin-post-editor__slug-line"><span className="admin-help">Đường dẫn:</span> <span className="admin-post-editor__path">{publicPath}</span><button className="admin-post-editor__link" onClick={() => setEditingSlug(true)} type="button">Sửa</button>{!slugTouched ? <span className="admin-help"> · tự tạo theo tên</span> : null}</p>}
          <div className="admin-form-grid admin-equipment-sale">
            <label className="admin-field" id="equipment-price">Giá bán (VNĐ)<input className="admin-input" inputMode="numeric" max={Number.MAX_SAFE_INTEGER} min={0} onChange={event => update("priceVnd", Math.max(0, Math.trunc(Number(event.target.value) || 0)))} type="number" value={form.priceVnd} /><small className="admin-help">Hiện trên website: {priceFormatter.format(form.priceVnd)}</small></label>
            <label className="admin-field">Bảo hành (tháng)<input className="admin-input" max={1200} min={0} onChange={event => update("warrantyMonths", Math.max(0, Math.trunc(Number(event.target.value) || 0)))} type="number" value={form.warrantyMonths} /></label>
            <label className="admin-field">Mã model<input className="admin-input" maxLength={80} onChange={event => update("modelCode", event.target.value || null)} placeholder="Ví dụ: SUNMI T2s" value={form.modelCode ?? ""} /></label>
          </div>
          <label className="admin-field" htmlFor="equipment-summary">Mô tả ngắn<textarea className="admin-input" id="equipment-summary" maxLength={20_000} onChange={event => update("summary", event.target.value || null)} placeholder="Thiết bị dùng để làm gì, phù hợp với mô hình nào. Hiện trên thẻ ở trang danh sách và đầu trang chi tiết." rows={4} value={summary} /></label>
        </AdminEditorSection>
        <AdminEditorSection description="Chia theo nhóm, ví dụ nhóm “Kết nối” có dòng “Cổng USB: 2 cổng”. Website hiện thành bảng." id="equipment-specs" step={2} title="Thông số kỹ thuật"><SpecificationGroupsEditor onChange={specificationGroups => update("specificationGroups", specificationGroups)} value={form.specificationGroups} /></AdminEditorSection>
        <AdminEditorSection title="Nội dung trang thiết bị" description="Các thành phần nội dung dùng chung Page Builder. Giá, bảo hành và thông số vẫn quản lý ở phần thông tin thiết bị."><CmsPageBuilder readOnly={!canEdit} documentId={id} document={{ kind: "equipment", values: form }} blocks={form.blocks ?? []} onChange={blocks => update("blocks", blocks)} disabled={processing} onUploadingChange={handleUploadingChange} showGroupPicker /></AdminEditorSection>
        <details className="admin-post-editor__panel">
          <summary><span><strong>Google &amp; chia sẻ mạng xã hội</strong><small>Mặc định lấy từ tên và mô tả ngắn — chỉ mở khi muốn đặt riêng.</small></span><AdminStatusBadge tone={seoPassed === checks.length ? "success" : "warning"}>SEO {seoPassed}/{checks.length} đạt</AdminStatusBadge></summary>
          <div className="admin-post-editor__panel-body">
            <SeoAssistant content={seoContent} excerpt={summary} hasCover={Boolean(form.coverMediaId)} onChange={(field, value) => update(field, value || null)} path={publicPath} seoDescription={form.seoDescription ?? ""} seoTitle={form.seoTitle ?? ""} slug={form.slug} title={form.name} />
            <ContentSeoEditor value={form.seo ?? {}} onChange={seo => update("seo", seo)} title={form.seoTitle || form.name} description={form.seoDescription || form.summary || ""} disabled={processing || !canEdit} onUploadingChange={handleUploadingChange} />
            <label className="admin-field">Địa chỉ chính thức của nội dung (nâng cao)<input className="admin-input" onChange={event => update("canonicalUrl", event.target.value || null)} placeholder="Chỉ điền khi nội dung này được sao chép từ một địa chỉ khác" type="url" value={form.canonicalUrl ?? ""} /></label>
          </div>
        </details>
        {id ? <details className="admin-post-editor__panel" onToggle={(event) => setHistoryOpen(event.currentTarget.open)}>
          <summary><span><strong>Lịch sử phiên bản</strong><small>Xem lại hoặc khôi phục bản đã lưu</small></span></summary>
          {historyOpen ? <div className="admin-post-editor__panel-body"><RevisionHistory disabled={isDirty || processing} expectedVersion={version} id={id} target="equipment" /></div> : null}
        </details> : null}
      </div>

      <aside aria-label="Thiết lập thiết bị" className="admin-post-editor__side">
        <section className="admin-content-section">
          <header className="admin-post-editor__card-head"><h3>Xuất bản</h3>{item ? <PublishedPreviewLink kind="equipment" slug={item.slug} status={savedStatus} /> : null}</header>
          {savedStatus ? <p className="admin-post-editor__state"><AdminStatusBadge tone={contentStatusBadge[savedStatus].tone}>{contentStatusBadge[savedStatus].label}</AdminStatusBadge></p> : <p className="admin-help">Thiết bị mới — chưa lưu.</p>}
          <ContentStatusChoice canPublish={canPublish} noun={noun} onChange={(status) => update("status", status)} savedStatus={savedStatus} value={form.status} />
          {form.status === "scheduled" ? <label className="admin-field">Thời điểm đăng<input className="admin-input" onChange={event => update("scheduledAt", event.target.value ? new Date(event.target.value) : null)} required type="datetime-local" value={formatLocalDateTime(form.scheduledAt)} /></label> : null}
          {goingLive ? <PrepublishHints missing={missing} /> : null}
        </section>
        <section className="admin-content-section" id="equipment-cover">
          <MediaPicker disabled={isSaving} hint="Hiện trên thẻ ở trang danh sách và đầu trang chi tiết. Nên dùng ảnh nền trắng, thiết bị nằm giữa." label="Ảnh bìa" onChange={coverMediaId => update("coverMediaId", coverMediaId)} onUploadingChange={handleUploadingChange} preview value={form.coverMediaId} />
        </section>
        <section className="admin-content-section">
          <header><h3>Phân loại &amp; hiển thị</h3></header>
          <div className="admin-field">Nhóm thiết bị<select aria-label="Nhóm thiết bị" className="admin-input" onChange={event => update("groupId", event.target.value)} required value={form.groupId}>{allGroups.length ? null : <option value="">Chưa có nhóm — tạo nhóm bên dưới</option>}{allGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><AdminInlineCreate disabled={processing} hint={canPublish ? undefined : "Nhóm mới ở trạng thái ẩn cho tới khi người có quyền xuất bản bật."} label="nhóm thiết bị" onCreate={createGroup} permission="equipment.create" /></div>
          <label className="admin-check"><input checked={form.isFeatured} onChange={event => update("isFeatured", event.target.checked)} type="checkbox" />Đánh dấu nổi bật</label>
          <label className="admin-field">Thứ tự trong danh sách<input className="admin-input" max={10_000} min={0} onChange={event => update("sortOrder", Math.max(0, Number(event.target.value) || 0))} type="number" value={form.sortOrder} /><small className="admin-help">Số nhỏ hiện trước.</small></label>
        </section>
      </aside>

      <AdminEditorActions><p className={isDirty ? "admin-help admin-text-warning" : "admin-help"} role="status">{isDirty ? "Có thay đổi chưa lưu." : savedStatus ? `Đã lưu · ${contentStatusBadge[savedStatus].label}` : "Thiết bị mới chưa lưu."}</p><AdminButton disabled={processing} permission={id ? "equipment.update" : "equipment.create"} title="Phím tắt: Ctrl+S" type="submit">{isUploading ? "Đang tải ảnh…" : isSaving ? "Đang lưu..." : contentSubmitLabel(form.status, savedStatus, noun)}</AdminButton></AdminEditorActions>
      </fieldset>
    </form>
  );
}
