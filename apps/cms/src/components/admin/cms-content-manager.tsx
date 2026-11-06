"use client";
import { requestAdminJson } from "@/lib/admin-api";
import { formatDisplayDateTime, formatLocalDateTime } from "@/lib/local-date-time";
import { toSlug } from "@/lib/slug";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { MediaPicker } from "./media-picker";
import { RevisionHistory } from "./revision-history";
import { PublishedPreviewLink, offeringCatalogPaths } from "./published-preview-link";
import { AdminButton } from "./ui/admin-button";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminStatusBadge } from "./ui/admin-feedback";
import { AdminFaqEditor, AdminListEditor, AdminListRowControls, moveListItem, type FaqItem } from "./ui/admin-list-editor";
import { ContentStatusChoice, PrepublishHints, contentStatusBadge, contentSubmitLabel } from "./ui/content-status-choice";
import { SeoAssistant } from "./ui/seo-assistant";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useRevisionRestore } from "./ui/use-revision-restore";

import { seoChecks, truncateAtWord } from "@iorder/core/server/shared/seo";
import type { AdminOffering, AdminOfferingInput, PublicOfferingType } from "@iorder/core/server/offerings/offering-content.contract";
import { useAdminPermissions } from "./ui/admin-permissions";
import { PricingEditor } from "./page-blocks-editor";
import { AppearanceEditor, defaultAppearance } from "./block-appearance-fields";
import { offeringSectionKeys, type OfferingSectionKey } from "@iorder/core/server/offerings/offering-content.contract";

// Các phần của trang chi tiết có thể chỉnh giao diện (cùng vỏ chung với khối trang; phần không có nội dung thì không hiện).
const offeringSectionLabels: Record<OfferingSectionKey, string> = { overview: "Tổng quan & tính năng chính", benefits: "Lợi ích mang lại", pricing: "Bảng giá", related: "Nội dung liên quan & hỏi đáp" };

type LinkItem = { title: string; href: string };

const inputClassName = "admin-input";
const labelClassName = "admin-field";
const summaryLimit = 200;

function EditorSection({ children, description, id, title }: { children: ReactNode; description?: string; id?: string; title: string }) {
  return <section className="admin-content-section" id={id}><header><h3>{title}</h3>{description ? <p className="admin-help">{description}</p> : null}</header>{children}</section>;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function dateTimeOrNull(value: string) {
  return value ? new Date(value) : null;
}

function filledLines(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

// Liên kết liên quan: chỉ có chữ thì website hiện chữ, có thêm đường dẫn thì hiện thành liên kết.
function OfferingLinksEditor({ items, onChange }: { items: LinkItem[]; onChange: (items: LinkItem[]) => void }) {
  function patch(index: number, value: Partial<LinkItem>) {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item));
  }
  return <div className="admin-list-editor">
    {items.length ? <ol className="admin-list-editor__rows">{items.map((item, index) => <li className="admin-list-editor__row admin-list-editor__row--faq" key={index}>
      <span aria-hidden="true" className="admin-list-editor__index">{index + 1}</span>
      <span className="admin-list-editor__pair admin-form-grid">
        <input aria-label={`Tên mục ${index + 1}`} className={inputClassName} maxLength={500} onChange={(event) => patch(index, { title: event.target.value })} placeholder="Tên hiển thị" value={item.title} />
        <input aria-label={`Đường dẫn mục ${index + 1}`} className={inputClassName} onChange={(event) => patch(index, { href: event.target.value })} pattern="(/(?!/)|https?://).*" placeholder="/lien-he hoặc https://… (không bắt buộc)" title="Bắt đầu bằng / hoặc https://" value={item.href} />
      </span>
      <AdminListRowControls index={index} label={`mục ${index + 1}`} length={items.length} onMove={(direction) => onChange(moveListItem(items, index, direction))} onRemove={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} />
    </li>)}</ol> : null}
    <AdminButton className="justify-self-start" disabled={items.length >= 100} leadingIcon={<Plus aria-hidden="true" size={15} />} onClick={() => onChange([...items, { title: "", href: "" }])} size="sm" variant="secondary">Thêm mục</AdminButton>
  </div>;
}

function requestJson(url: string, method: "PATCH" | "POST", body: unknown) {
  return requestAdminJson(url, method, body, "Không thể lưu thay đổi. Vui lòng thử lại.");
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
  const canPublish = can("offerings.publish");
  const noun = offeringTypeLabel.toLocaleLowerCase("vi");
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
  const [editingSlug, setEditingSlug] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Nội dung mới: slug tự theo tiêu đề cho tới khi người dùng tự sửa. Nội dung đã có giữ slug (đổi slug làm hỏng liên kết).
  const [slugTouched, setSlugTouched] = useState(Boolean(offering));
  const [extraOpen] = useState(() => Boolean(offering && (offering.content.bestFor || offering.content.keyValue || offering.content.category || offering.icon || offering.content.tags.length || offering.content.metrics.length)));
  const { isDirty, markSaved } = useUnsavedChanges(form);
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);
  const formRef = useRef<HTMLFormElement>(null);
  // Ctrl+S / ⌘+S lưu ngay, không phải cuộn xuống thanh lưu.
  useEffect(() => {
    function save(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); formRef.current?.requestSubmit(); }
    }
    window.addEventListener("keydown", save);
    return () => window.removeEventListener("keydown", save);
  }, []);

  function update<Field extends keyof typeof form>(field: Field, value: (typeof form)[Field]) {
    if (saving.current || restore.pending.current) return;
    setForm((current) => ({ ...current, [field]: value }));
  }
  function changeTitle(title: string) {
    if (saving.current || restore.pending.current) return;
    setForm((current) => ({ ...current, title, ...(slugTouched ? {} : { slug: toSlug(title, 80) }) }));
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
      onError(error instanceof Error ? error.message : `Không thể lưu ${noun}.`);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  const publicPath = `${offeringCatalogPaths[form.type] ?? ""}/${form.slug || "duong-dan"}`;
  // Trợ lý SEO dùng chung với bài viết: mô tả chi tiết đóng vai trò nội dung.
  const seoContent = { blocks: [{ type: "paragraph", text: form.description }] };
  const checks = seoChecks({ title: form.title, seoTitle: form.seoTitle, seoDescription: form.seoDescription, excerpt: form.summary, slug: form.slug, hasCover: Boolean(form.coverMediaId), content: seoContent });
  const seoPassed = checks.filter((check) => check.ok).length;
  const savedStatus = offering?.status;
  const goingLive = form.status === "published" || form.status === "scheduled";
  const missing = [
    !form.coverMediaId ? { id: "offering-cover", label: "Ảnh bìa" } : null,
    !form.summary.trim() ? { id: "offering-summary", label: "Tóm tắt" } : null,
    !filledLines(form.features).length ? { id: "offering-features", label: "Tính năng chính" } : null,
    !filledLines(form.benefits).length ? { id: "offering-benefits", label: "Lợi ích" } : null,
  ].filter((item): item is { id: string; label: string } => item !== null);

  // Bố cục 2 cột như editor bài viết: trái để viết, phải là thiết lập luôn nhìn thấy.
  return (
    <form className="admin-post-editor" onSubmit={submit} ref={formRef}>
      <fieldset disabled={processing} className="contents">
      <div className="admin-post-editor__main">
        <section className="admin-content-section admin-post-editor__writing">
          <label className="admin-post-editor__title-field"><span className="sr-only">Tên {noun}</span><input className="admin-post-editor__title" maxLength={220} onChange={(event) => changeTitle(event.target.value)} placeholder={`Nhập tên ${noun}…`} required value={form.title} /></label>
          {editingSlug ? <div className="admin-post-editor__slug-edit">
            <div className={labelClassName}><label className="admin-seo__label" htmlFor="offering-slug">Đường dẫn (slug)<span className="admin-help">{publicPath}</span></label><span className="admin-post-editor__slug"><input autoFocus className={inputClassName} id="offering-slug" maxLength={180} onChange={(event) => { setSlugTouched(true); update("slug", event.target.value); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={form.slug} /><AdminButton disabled={!form.title.trim() || toSlug(form.title, 80) === form.slug} onClick={() => { setSlugTouched(true); update("slug", toSlug(form.title, 80)); }} size="sm" variant="secondary">Tạo từ tên</AdminButton><AdminButton onClick={() => setEditingSlug(false)} size="sm" variant="ghost">Xong</AdminButton></span></div>
            {savedStatus === "published" && form.status === "published" ? <small className="admin-help">{offeringTypeLabel} đang hiển thị: khi lưu với đường dẫn mới, đường dẫn cũ tự chuyển hướng (301) sang đường dẫn mới.</small> : savedStatus === "published" ? <small className="admin-help admin-text-warning">Sau lần lưu này nội dung chưa hiện ngay trên website nên đổi đường dẫn sẽ không tạo chuyển hướng từ đường dẫn cũ.</small> : <small className="admin-help">Chỉ dùng chữ thường không dấu, số và dấu gạch ngang.</small>}
          </div> : <p className="admin-post-editor__slug-line"><span className="admin-help">Đường dẫn:</span> <span className="admin-post-editor__path">{publicPath}</span><button className="admin-post-editor__link" onClick={() => setEditingSlug(true)} type="button">Sửa</button>{!slugTouched ? <span className="admin-help"> · tự tạo theo tên</span> : null}</p>}
          <div className={labelClassName}>
            <span className="admin-seo__label"><label htmlFor="offering-summary">Tóm tắt</label><span className={form.summary.trim().length > summaryLimit ? "admin-seo__count admin-seo__count--over" : "admin-seo__count"}>{form.summary.trim().length}/{summaryLimit} ký tự</span>{form.description.trim() && !form.summary.trim() ? <button className="admin-post-editor__link" onClick={() => update("summary", truncateAtWord(form.description, summaryLimit))} type="button">Lấy từ mô tả</button> : null}</span>
            <textarea className={inputClassName} id="offering-summary" onChange={(event) => update("summary", event.target.value)} placeholder="1–2 câu giới thiệu, hiện trên thẻ ở trang danh sách và khi chia sẻ Facebook/Zalo." rows={2} value={form.summary} />
          </div>
          <label className={labelClassName} htmlFor="offering-description">Mô tả chi tiết<textarea className={inputClassName} id="offering-description" maxLength={20_000} onChange={(event) => update("description", event.target.value)} placeholder={`Giới thiệu ${noun}: giải quyết vấn đề gì, dành cho ai, khác biệt ở đâu. Hiện ở mục "Tổng quan" trên website.`} required rows={7} value={form.description} /></label>
        </section>
        <EditorSection description={`Mỗi mục một dòng ngắn. Nhấn Enter để thêm mục tiếp theo.`} id="offering-features" title="Tính năng chính"><AdminListEditor addLabel="Thêm tính năng" itemLabel="Tính năng" items={form.features} maxItems={100} onChange={(items) => update("features", items)} placeholder="Ví dụ: Gọi món tại bàn bằng mã QR" /></EditorSection>
        <EditorSection description="Khách hàng được gì khi dùng — nói theo kết quả, không lặp lại tính năng." id="offering-benefits" title="Lợi ích mang lại"><AdminListEditor addLabel="Thêm lợi ích" itemLabel="Lợi ích" items={form.benefits} maxItems={100} onChange={(items) => update("benefits", items)} placeholder="Ví dụ: Giảm thời gian chờ món vào giờ cao điểm" /></EditorSection>
        <EditorSection description="Hiện trên trang chi tiết, sau phần lợi ích. Để trống nếu báo giá theo yêu cầu." id="offering-pricing" title="Bảng giá">
          {form.pricing ? <>
            <PricingEditor onChange={(pricing) => update("pricing", pricing)} value={form.pricing} />
            <AdminButton className="justify-self-start" onClick={() => update("pricing", null)} size="sm" variant="ghost">Bỏ bảng giá</AdminButton>
          </> : <AdminButton className="justify-self-start" onClick={() => update("pricing", { eyebrow: "Bảng giá", title: truncateAtWord(`Chọn gói ${form.title || noun}`, 220), description: null, note: null, plans: [{ name: "Cơ bản", price: "Liên hệ", period: null, description: null, features: [], action: { label: "Nhận tư vấn", href: "/lien-he" }, highlighted: false, badge: null }] })} size="sm" variant="secondary">Thêm bảng giá</AdminButton>}
        </EditorSection>
        <EditorSection description="Hiện dạng mở/đóng ở cuối trang." title="Câu hỏi thường gặp"><AdminFaqEditor items={form.faq} maxItems={50} onChange={(items) => update("faq", items)} /></EditorSection>
        <EditorSection description="Ví dụ: tài liệu, bảng giá, trang liên hệ. Để trống đường dẫn nếu chỉ muốn hiện chữ." title="Nội dung liên quan"><OfferingLinksEditor items={form.items} onChange={(items) => update("items", items)} /></EditorSection>
        <details className="admin-post-editor__panel">
          <summary><span><strong>Giao diện các phần trang</strong><small>Nền, màu tự chọn, ảnh nền, độ rộng từng phần — để “Tự động” thì nền trắng / xanh nhạt xen kẽ.</small></span>{offeringSectionKeys.some((key) => form.appearance[key]) ? <AdminStatusBadge tone="info">Đã chỉnh</AdminStatusBadge> : null}</summary>
          <div className="admin-post-editor__panel-body">
            {offeringSectionKeys.map((key) => <fieldset className="admin-block-group" key={key}>
              <legend>{offeringSectionLabels[key]}</legend>
              <AppearanceEditor onChange={(patch) => update("appearance", { ...form.appearance, [key]: { ...defaultAppearance, ...form.appearance[key], ...patch } })} value={form.appearance[key]} />
              {form.appearance[key] ? <AdminButton className="justify-self-start" onClick={() => { const next = { ...form.appearance }; delete next[key]; update("appearance", next); }} size="sm" variant="ghost">Về mặc định</AdminButton> : null}
            </fieldset>)}
          </div>
        </details>
        <details className="admin-post-editor__panel">
          <summary><span><strong>Google &amp; chia sẻ mạng xã hội</strong><small>Mặc định lấy từ tên và tóm tắt — chỉ mở khi muốn đặt riêng.</small></span><AdminStatusBadge tone={seoPassed === checks.length ? "success" : "warning"}>SEO {seoPassed}/{checks.length} đạt</AdminStatusBadge></summary>
          <div className="admin-post-editor__panel-body">
            <SeoAssistant content={seoContent} excerpt={form.summary} hasCover={Boolean(form.coverMediaId)} onChange={(field, value) => update(field, value)} path={publicPath} seoDescription={form.seoDescription} seoTitle={form.seoTitle} slug={form.slug} title={form.title} />
            <label className={labelClassName}>URL chuẩn (canonical)<input className={inputClassName} onChange={(event) => update("canonicalUrl", event.target.value)} placeholder="https://… — chỉ điền khi trang này là bản sao của trang khác" type="url" value={form.canonicalUrl} /></label>
          </div>
        </details>
        <details className="admin-post-editor__panel" open={extraOpen}>
          <summary><span><strong>Thông tin bổ sung</strong><small>Phù hợp với, giá trị chính, chỉ số, thẻ — chưa hiện trên website hiện tại</small></span></summary>
          <div className="admin-post-editor__panel-body">
            <div className="admin-form-grid">
              <label className={labelClassName}>Phù hợp với<input className={inputClassName} maxLength={500} onChange={(event) => update("bestFor", event.target.value)} placeholder="Ví dụ: Nhà hàng 10–50 bàn" value={form.bestFor} /></label>
              <label className={labelClassName}>Giá trị chính<input className={inputClassName} maxLength={500} onChange={(event) => update("keyValue", event.target.value)} placeholder="Một câu nêu lợi ích lớn nhất" value={form.keyValue} /></label>
              <label className={labelClassName}>Danh mục<input className={inputClassName} maxLength={180} onChange={(event) => update("category", event.target.value)} placeholder="Ví dụ: Quản lý bán hàng" value={form.category} /></label>
              <label className={labelClassName}>Biểu tượng<input className={inputClassName} maxLength={120} onChange={(event) => update("icon", event.target.value)} placeholder="Tên biểu tượng" value={form.icon} /></label>
            </div>
            <div className={labelClassName}><span>Chỉ số nổi bật</span><AdminListEditor addLabel="Thêm chỉ số" itemLabel="Chỉ số" items={form.metrics} maxItems={50} onChange={(items) => update("metrics", items)} placeholder="Ví dụ: 500+ nhà hàng đang dùng" /></div>
            <div className={labelClassName}><span>Thẻ</span><AdminListEditor addLabel="Thêm thẻ" itemLabel="Thẻ" items={form.tags} maxItems={50} onChange={(items) => update("tags", items)} placeholder="Ví dụ: F&B" /></div>
          </div>
        </details>
        {offering ? <details className="admin-post-editor__panel" onToggle={(event) => setHistoryOpen(event.currentTarget.open)}>
          <summary><span><strong>Lịch sử phiên bản</strong><small>Xem lại hoặc khôi phục bản đã lưu</small></span></summary>
          {historyOpen ? <div className="admin-post-editor__panel-body"><RevisionHistory target="offerings" id={offering.id} expectedVersion={savedVersion} disabled={isDirty || processing} onRestorePendingChange={restore.onPendingChange} onRestored={restore.onRestored} /></div> : null}
        </details> : null}
      </div>

      <aside aria-label={`Thiết lập ${noun}`} className="admin-post-editor__side">
        <section className="admin-content-section">
          <header className="admin-post-editor__card-head"><h3>Xuất bản</h3>{offering ? <PublishedPreviewLink contentType={offering.type} id={offering.id} kind="offering" slug={offering.slug} status={offering.status} /> : null}</header>
          {offering && isDirty ? <p className="admin-help">Xem trước hiển thị bản đã lưu — lưu trước để thấy thay đổi mới.</p> : null}
          {offering ? <p className="admin-post-editor__state"><AdminStatusBadge tone={contentStatusBadge[offering.status].tone}>{contentStatusBadge[offering.status].label}</AdminStatusBadge>{offering.publishedAt ? <small className="admin-help">Đăng lúc {formatDisplayDateTime(offering.publishedAt)}</small> : null}</p> : <p className="admin-help">{offeringTypeLabel} mới — chưa lưu.</p>}
          <ContentStatusChoice canPublish={canPublish} noun={noun} onChange={(status) => update("status", status)} savedStatus={savedStatus} value={form.status} />
          {form.status === "scheduled" ? <label className={labelClassName}>Thời điểm đăng<input className={inputClassName} onChange={(event) => update("scheduledAt", event.target.value)} required type="datetime-local" value={form.scheduledAt} /></label> : null}
          {goingLive ? <PrepublishHints missing={missing} /> : null}
        </section>
        <section className="admin-content-section" id="offering-cover">
          <MediaPicker preview hint="Hiện trên thẻ ở trang danh sách, đầu trang chi tiết và khi chia sẻ Facebook/Zalo. Nên dùng ảnh ngang 1200×630." label="Ảnh bìa" onChange={value => update("coverMediaId", value)} onUploadingChange={handleUploadingChange} value={form.coverMediaId} />
        </section>
        <section className="admin-content-section">
          <header><h3>Hiển thị</h3></header>
          {offeringType ? null : <label className={labelClassName}>Nhóm nội dung<select className={inputClassName} onChange={(event) => update("type", event.target.value as typeof form.type)} value={form.type}><option value="software">Phần mềm</option><option value="solution">Giải pháp</option><option value="service">Dịch vụ</option></select></label>}
          <label className="admin-check"><input checked={form.isFeatured} onChange={(event) => update("isFeatured", event.target.checked)} type="checkbox" />Đánh dấu nổi bật</label>
          <label className={labelClassName}>Thứ tự trong danh sách<input className={inputClassName} max={10_000} min={0} onChange={(event) => update("sortOrder", Number(event.target.value))} type="number" value={form.sortOrder} /><small className="admin-help">Số nhỏ hiện trước.</small></label>
        </section>
      </aside>

      <AdminEditorActions><p className={isDirty ? "admin-help admin-text-warning" : "admin-help"} role="status">{isDirty ? "Có thay đổi chưa lưu." : offering ? `Đã lưu · ${contentStatusBadge[offering.status].label}` : `${offeringTypeLabel} mới chưa lưu.`}</p><AdminButton disabled={isSaving} permission={offering ? "offerings.update" : "offerings.create"} title="Phím tắt: Ctrl+S" type="submit">{isSaving ? "Đang lưu..." : contentSubmitLabel(form.status, savedStatus, noun)}</AdminButton></AdminEditorActions>
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
    tags: offering?.content.tags ?? [],
    bestFor: offering?.content.bestFor ?? "",
    keyValue: offering?.content.keyValue ?? "",
    metrics: offering?.content.metrics ?? [],
    features: offering?.content.features ?? [],
    benefits: offering?.content.benefits ?? [],
    faq: offering?.content.faq.map(([question, answer]): FaqItem => ({ question, answer })) ?? [],
    items: offering?.content.items.map((item): LinkItem => typeof item === "string" ? { title: item, href: "" } : { title: item.title, href: item.href }) ?? [],
    category: offering?.content.category ?? "",
    pricing: offering?.content.pricing ?? null,
    appearance: offering?.content.appearance ?? {},
    icon: offering?.icon ?? "",
    status: offering?.status ?? "draft",
    scheduledAt: formatLocalDateTime(offering?.scheduledAt),
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
      tags: filledLines(form.tags),
      bestFor: nullableText(form.bestFor),
      keyValue: nullableText(form.keyValue),
      metrics: filledLines(form.metrics),
      features: filledLines(form.features),
      benefits: filledLines(form.benefits),
      faq: form.faq.map(({ question, answer }): [string, string] => [question.trim(), answer.trim()]).filter(([question, answer]) => Boolean(question && answer)),
      items: form.items.map(({ title, href }) => ({ title: title.trim(), href: href.trim() })).filter(({ title }) => Boolean(title)).map(({ title, href }) => href ? { title, href } : title),
      category: nullableText(form.category),
      pricing: form.pricing,
      appearance: form.appearance,
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
