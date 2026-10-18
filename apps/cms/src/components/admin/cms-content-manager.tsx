"use client";
import { PublishPermissionHint, PublishStatusOptions } from "./ui/publish-status-options";
import { requestAdminJson } from "@/lib/admin-api";
import { formatLocalDateTime } from "@/lib/local-date-time";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { MediaPicker } from "./media-picker";
import { RevisionHistory } from "./revision-history";
import { AdminEditorTabs } from "./ui/admin-editor-tabs";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { AdminNotice } from "./ui/admin-feedback";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useRevisionRestore } from "./ui/use-revision-restore";

import type { AdminOffering, AdminOfferingInput, PublicOfferingType } from "@iorder/core/server/offerings/offering-content.contract";
import { useAdminPermissions } from "./ui/admin-permissions";

type Notice = { kind: "error" | "success"; message: string } | undefined;
type OfferingItem = AdminOfferingInput["content"]["items"][number];

type CmsContentManagerProps = {
  initialOfferings: AdminOffering[];
  offeringType?: PublicOfferingType;
  offeringTypeLabel?: string;
  showOfferings?: boolean;
};

const inputClassName = "admin-input";
const labelClassName = "admin-field";

function EditorSection({ children, description, title }: { children: ReactNode; description?: string; title: string }) {
  return <section className="admin-content-section"><header><h3>{title}</h3>{description ? <p className="admin-help">{description}</p> : null}</header>{children}</section>;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function dateTimeInputValue(value: Date | null | undefined) {
  return formatLocalDateTime(value);
}

function dateTimeOrNull(value: string) {
  return value ? new Date(value) : null;
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function faqLines(value: string): [string, string][] {
  return value
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter((parts): parts is [string, string] => parts.length === 2 && Boolean(parts[0]) && Boolean(parts[1]));
}

function moveOfferingItem(items: OfferingItem[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const result = [...items];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

function OfferingItemsEditor({ items, onChange }: { items: OfferingItem[]; onChange: (items: OfferingItem[]) => void }) {
  return <fieldset className="admin-subsection">
    <legend>Mục liên quan</legend>
    <p className="admin-help">Mỗi mục có thể chỉ là văn bản, hoặc có đường dẫn nội bộ như <code>/lien-he</code> hay URL ngoài.</p>
    {items.map((item, index) => {
      const linkedItem = typeof item === "string" ? undefined : item;
      const title = typeof item === "string" ? item : item.title;
      return <div className="admin-subsection" key={index}>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <label className={labelClassName}>Loại mục<select className={inputClassName} value={linkedItem ? "link" : "text"} onChange={event => onChange(items.map((entry, entryIndex) => entryIndex !== index ? entry : event.target.value === "link" ? { title, href: "/" } : title))}><option value="text">Văn bản</option><option value="link">Có đường dẫn</option></select></label>
          <label className={labelClassName}>Nội dung<input className={inputClassName} required value={title} onChange={event => onChange(items.map((entry, entryIndex) => entryIndex !== index ? entry : typeof entry === "string" ? event.target.value : { ...entry, title: event.target.value }))} /></label>
        </div>
        {linkedItem ? <label className={labelClassName}>Đường dẫn<input className={inputClassName} required value={linkedItem.href} onChange={event => onChange(items.map((entry, entryIndex) => entryIndex === index && typeof entry !== "string" ? { ...entry, href: event.target.value } : entry))} placeholder="/lien-he hoặc https://..." /></label> : null}
        <div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => onChange(moveOfferingItem(items, index, -1))}>Lên</button><button type="button" disabled={index === items.length - 1} onClick={() => onChange(moveOfferingItem(items, index, 1))}>Xuống</button><button type="button" className="admin-button admin-button--danger admin-button--sm" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Xóa</button></div>
      </div>;
    })}
    <button type="button" className="justify-self-start" onClick={() => onChange([...items, "Mục mới"])}>Thêm mục</button>
  </fieldset>;
}

function requestJson(url: string, method: "PATCH" | "POST", body: unknown) {
  return requestAdminJson(url, method, body, "Không thể lưu thay đổi. Vui lòng thử lại.");
}

export function CmsContentManager({ initialOfferings, offeringType, offeringTypeLabel = "Nội dung catalog", showOfferings = true }: CmsContentManagerProps) {
  const searchParams = useSearchParams();
  const requestedOfferingId = searchParams.get("edit");
  const [offerings, setOfferings] = useState(initialOfferings);
  const [activeOfferingId, setActiveOfferingId] = useState<string | undefined>(() => initialOfferings.some(offering => offering.id === requestedOfferingId) ? requestedOfferingId ?? undefined : initialOfferings[0]?.id);
  const [isCreatingOffering, setIsCreatingOffering] = useState(() => searchParams.get("create") === "1");
  const [notice, setNotice] = useState<Notice>();

  const activeOffering = offerings.find((offering) => offering.id === activeOfferingId);

  function notify(nextNotice: Notice) {
    setNotice(nextNotice);
  }

  return (
    <div className="grid gap-12">
      {notice ? <AdminNotice tone={notice.kind}>{notice.message}</AdminNotice> : null}

      {showOfferings ? <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="admin-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2>{offeringTypeLabel}</h2>
            <button className="admin-button admin-button--primary" onClick={() => { setIsCreatingOffering(true); setActiveOfferingId(undefined); }} type="button">
              Thêm mới
            </button>
          </div>
          <div className="grid gap-2">
            {offerings.map((offering) => (
              <button className={`rounded-[var(--cms-radius-card)] px-3 py-3 text-left text-sm transition ${offering.id === activeOfferingId && !isCreatingOffering ? "bg-[var(--cms-primary-soft)] text-[var(--cms-primary)]" : "hover:bg-[var(--cms-hover)]"}`} key={offering.id} onClick={() => { setActiveOfferingId(offering.id); setIsCreatingOffering(false); }} type="button">
                <span className="block font-medium">{offering.title}</span>
                <span className="admin-field__hint block">{offering.type} · {offering.status}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="admin-card">
          {isCreatingOffering || activeOffering ? (
            <OfferingEditor
              key={activeOffering?.id ?? "new"}
              offering={activeOffering}
              offeringType={offeringType}
              offeringTypeLabel={offeringTypeLabel}
              onSaved={(offering, created) => {
                setOfferings((current) => created ? [...current, offering] : current.map((item) => item.id === offering.id ? offering : item));
                setActiveOfferingId(offering.id);
                setIsCreatingOffering(false);
                notify({ kind: "success", message: created ? "Đã tạo nội dung catalog ở trạng thái đã chọn." : "Đã lưu nội dung catalog và tạo phiên bản mới." });
              }}
              onError={(message) => notify({ kind: "error", message })}
            />
          ) : <p className="admin-text-muted">Chọn một nội dung catalog để chỉnh sửa.</p>}
        </div>
      </section> : null}

    </div>
  );
}

export function OfferingEditor({ offering, offeringType, offeringTypeLabel, onSaved, onError, onDirtyChange }: {
  offering: AdminOffering | undefined;
  offeringType?: PublicOfferingType;
  offeringTypeLabel: string;
  onSaved: (offering: AdminOffering, created: boolean) => void;
  onError: (message: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}) {
  const { can } = useAdminPermissions();
  const [form, setForm] = useState(() => offeringToForm(offering, offeringType));
  const [savedVersion, setSavedVersion] = useState(offering?.draftVersion);
  const saving = useRef(false);
  const restore = useRevisionRestore();
  const uploading = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const handleUploadingChange = useCallback((pending: boolean) => {
    uploading.current = pending;
    setIsUploading(pending);
  }, []);
  const [isSaving, setIsSaving] = useState(false);
  const processing = isSaving || isUploading || restore.restoring;
  useNavigationGuard(processing && !restore.completing, () => onError("Đang xử lý nội dung. Vui lòng chờ trước khi rời màn hình."));
  const [activeTab, setActiveTab] = useState("basic");
  const { isDirty, markSaved } = useUnsavedChanges(form);
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  function update<Field extends keyof typeof form>(field: Field, value: (typeof form)[Field]) {
    if (saving.current || restore.pending.current) return;
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || uploading.current || restore.pending.current) return;
    saving.current = true;
    setIsSaving(true);

    try {
      const payload = offeringFormToInput(form);
      const typeGuard = offeringType ? `?type=${offeringType}` : "";
      const result = await requestJson(offering ? `/api/admin/offerings/${offering.id}${typeGuard}` : `/api/admin/offerings${typeGuard}`, offering ? "PATCH" : "POST", offering ? { ...payload, expectedVersion: savedVersion } : payload) as { offering: AdminOffering };
      if (!result.offering || (offering && result.offering.id !== offering.id) || !Number.isSafeInteger(result.offering.draftVersion) || result.offering.draftVersion !== (savedVersion ?? 0) + 1) throw new Error("Phản hồi phiên bản nội dung không hợp lệ. Kiểm tra danh sách trước khi thử lại.");
      setSavedVersion(result.offering.draftVersion);
      markSaved();
      onSaved(result.offering, !offering);
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : "Không thể lưu nội dung catalog.");
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <fieldset disabled={processing} className="contents">
      <AdminEditorTabs activeId={activeTab} onChange={setActiveTab} tabs={[{ id: "basic", label: "Thông tin" }, { id: "content", label: "Nội dung" }, { id: "publishing", label: "Xuất bản & SEO" }, ...(offering ? [{ id: "history", label: "Lịch sử" }] : [])]} />
      {activeTab === "basic" ? <div className="grid gap-4"><EditorSection title="Thông tin cơ bản"><div className="admin-form-grid">{offeringType ? <label className={labelClassName}>Nhóm nội dung<input className={inputClassName} readOnly value={offeringTypeLabel} /></label> : <label className={labelClassName}>Nhóm nội dung<select className={inputClassName} onChange={(event) => update("type", event.target.value as typeof form.type)} value={form.type}><option value="software">Phần mềm</option><option value="solution">Giải pháp</option><option value="service">Dịch vụ</option></select></label>}<label className={labelClassName}>Tiêu đề<input className={inputClassName} onChange={(event) => update("title", event.target.value)} required value={form.title} /></label><label className={labelClassName}>Slug<input className={inputClassName} onChange={(event) => update("slug", event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={form.slug} /></label></div></EditorSection><EditorSection description="Ảnh đại diện hiển thị trong các danh sách và trang chi tiết." title="Media"><MediaPicker value={form.coverMediaId} onChange={value => update("coverMediaId", value)} onUploadingChange={handleUploadingChange} /></EditorSection></div> : null}
      {activeTab === "content" ? <div className="grid gap-4"><EditorSection title="Nội dung"><label className={labelClassName}>Tóm tắt<textarea className={inputClassName} onChange={(event) => update("summary", event.target.value)} rows={3} value={form.summary} /></label><label className={labelClassName}>Mô tả chi tiết<textarea className={inputClassName} onChange={(event) => update("description", event.target.value)} required rows={5} value={form.description} /></label></EditorSection><EditorSection description="Chỉ thêm các thông tin thực sự xuất hiện với loại nội dung này." title={`Thông tin ${offeringTypeLabel.toLocaleLowerCase("vi")}`}><OfferingItemsEditor items={form.items} onChange={items => update("items", items)} /><div className="admin-form-grid"><label className={labelClassName}>Tags, mỗi dòng một mục<textarea className={inputClassName} onChange={(event) => update("tags", event.target.value)} rows={4} value={form.tags} /></label><label className={labelClassName}>Chỉ số, mỗi dòng một mục<textarea className={inputClassName} onChange={(event) => update("metrics", event.target.value)} rows={4} value={form.metrics} /></label><label className={labelClassName}>Tính năng, mỗi dòng một mục<textarea className={inputClassName} onChange={(event) => update("features", event.target.value)} rows={5} value={form.features} /></label><label className={labelClassName}>Lợi ích, mỗi dòng một mục<textarea className={inputClassName} onChange={(event) => update("benefits", event.target.value)} rows={5} value={form.benefits} /></label></div><label className={labelClassName}>FAQ, mỗi dòng theo mẫu “Câu hỏi | Trả lời”<textarea className={inputClassName} onChange={(event) => update("faq", event.target.value)} rows={5} value={form.faq} /></label><div className="admin-form-grid"><label className={labelClassName}>Phù hợp với<input className={inputClassName} onChange={(event) => update("bestFor", event.target.value)} value={form.bestFor} /></label><label className={labelClassName}>Giá trị chính<input className={inputClassName} onChange={(event) => update("keyValue", event.target.value)} value={form.keyValue} /></label><label className={labelClassName}>Danh mục<input className={inputClassName} onChange={(event) => update("category", event.target.value)} value={form.category} /></label><label className={labelClassName}>Biểu tượng<input className={inputClassName} onChange={(event) => update("icon", event.target.value)} value={form.icon} /></label></div></EditorSection></div> : null}
      {activeTab === "publishing" ? <div className="grid gap-4">
        <EditorSection title="SEO"><div className="admin-form-grid"><label className={labelClassName}>Tiêu đề SEO<input className={inputClassName} onChange={(event) => update("seoTitle", event.target.value)} value={form.seoTitle} /></label><label className={labelClassName}>Mô tả SEO<input className={inputClassName} onChange={(event) => update("seoDescription", event.target.value)} value={form.seoDescription} /></label><label className={labelClassName}>URL chuẩn<input className={inputClassName} onChange={(event) => update("canonicalUrl", event.target.value)} type="url" value={form.canonicalUrl} /></label></div></EditorSection>
        <EditorSection title="Xuất bản"><div className="admin-form-grid"><label className={labelClassName}>Trạng thái<select className={inputClassName} onChange={(event) => update("status", event.target.value as typeof form.status)} value={form.status}><PublishStatusOptions canPublish={can("offerings.publish")} current={form.status} /></select></label><PublishPermissionHint canPublish={can("offerings.publish")} />{form.status === "scheduled" ? <label className={labelClassName}>Thời điểm hẹn giờ<input className={inputClassName} onChange={(event) => update("scheduledAt", event.target.value)} required type="datetime-local" value={form.scheduledAt} /></label> : null}<label className={labelClassName}>Thứ tự<input className={inputClassName} min="0" onChange={(event) => update("sortOrder", Number(event.target.value))} type="number" value={form.sortOrder} /></label><label className="admin-check"><input checked={form.isFeatured} onChange={(event) => update("isFeatured", event.target.checked)} type="checkbox" />Nội dung nổi bật</label></div></EditorSection>
      </div> : null}
      {activeTab === "history" && offering ? <EditorSection title="Lịch sử"><RevisionHistory target="offerings" id={offering.id} expectedVersion={savedVersion} disabled={isDirty || processing} onRestorePendingChange={restore.onPendingChange} onRestored={restore.onRestored} /></EditorSection> : null}
      <AdminEditorActions>{isDirty ? <p className="admin-help admin-text-warning" role="status">Có thay đổi chưa lưu.</p> : null}<button className="admin-button admin-button--primary" disabled={isSaving || !can(offering ? "offerings.update" : "offerings.create")} type="submit">{isSaving ? "Đang lưu..." : offering ? "Lưu thay đổi" : "Tạo nội dung catalog"}</button></AdminEditorActions>
      </fieldset>
    </form>
  );
}

function offeringToForm(offering: AdminOffering | undefined, offeringType?: PublicOfferingType) {
  return {
    coverMediaId: offering?.coverMediaId ?? null,
    type: offering?.type ?? offeringType ?? "software",
    title: offering?.title ?? "",
    slug: offering?.slug ?? "",
    summary: offering?.summary ?? "",
    description: offering?.content.description ?? "",
    tags: offering?.content.tags.join("\n") ?? "",
    bestFor: offering?.content.bestFor ?? "",
    keyValue: offering?.content.keyValue ?? "",
    metrics: offering?.content.metrics.join("\n") ?? "",
    features: offering?.content.features.join("\n") ?? "",
    benefits: offering?.content.benefits.join("\n") ?? "",
    faq: offering?.content.faq.map(([question, answer]) => `${question} | ${answer}`).join("\n") ?? "",
    items: offering?.content.items ?? [],
    category: offering?.content.category ?? "",
    icon: offering?.icon ?? "",
    status: offering?.status ?? "draft",
    scheduledAt: dateTimeInputValue(offering?.scheduledAt),
    sortOrder: offering?.sortOrder ?? 0,
    isFeatured: offering?.isFeatured ?? false,
    seoTitle: offering?.seoTitle ?? "",
    seoDescription: offering?.seoDescription ?? "",
    canonicalUrl: offering?.canonicalUrl ?? "",
  };
}

function offeringFormToInput(form: ReturnType<typeof offeringToForm>): AdminOfferingInput {
  return {
    coverMediaId: form.coverMediaId,
    type: form.type,
    title: form.title.trim(),
    slug: form.slug.trim(),
    summary: nullableText(form.summary),
    content: {
      description: form.description.trim(),
      tags: lines(form.tags),
      bestFor: nullableText(form.bestFor),
      keyValue: nullableText(form.keyValue),
      metrics: lines(form.metrics),
      features: lines(form.features),
      benefits: lines(form.benefits),
      faq: faqLines(form.faq),
      items: form.items,
      category: nullableText(form.category),
    },
    icon: nullableText(form.icon),
    status: form.status,
    scheduledAt: dateTimeOrNull(form.scheduledAt),
    sortOrder: form.sortOrder,
    isFeatured: form.isFeatured,
    seoTitle: nullableText(form.seoTitle),
    seoDescription: nullableText(form.seoDescription),
    canonicalUrl: nullableText(form.canonicalUrl),
  };
}
