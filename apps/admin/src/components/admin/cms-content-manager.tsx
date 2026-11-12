"use client";
import { ContentSeoEditor } from "./content-seo-editor";
import { CmsPageBuilder } from "./cms-page-builder";
import { requestAdminJson } from "@/lib/admin-api";
import { formatDisplayDateTime, formatLocalDateTime } from "@/lib/local-date-time";
import { toSlug } from "@/lib/slug";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { MediaPicker } from "./media-picker";
import { RevisionHistory } from "./revision-history";
import { PublishedPreviewLink, offeringCatalogPaths } from "./published-preview-link";
import { AdminButton } from "./ui/admin-button";
import { AdminEditorOutline, AdminEditorSection } from "./ui/admin-editor-section";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminNotice, AdminStatusBadge } from "./ui/admin-feedback";
import { AdminListEditor, AdminListRowControls, moveListItem, type FaqItem } from "./ui/admin-list-editor";
import { ContentStatusChoice, PrepublishHints, contentStatusBadge, contentSubmitLabel } from "./ui/content-status-choice";
import { SeoAssistant } from "./ui/seo-assistant";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useRevisionRestore } from "./ui/use-revision-restore";

import { seoChecks, truncateAtWord } from "@iorder/shared/server/shared/seo";
import type { AdminOffering, AdminOfferingInput, PublicOfferingType } from "@iorder/shared/server/offerings/offering-content.contract";
import { AppearanceEditor, defaultAppearance } from "./block-appearance-fields";
import { DetailHeroLayoutFields } from "./ui/detail-hero-layout-fields";
import { pageBlockInputSchema, type PageBlock } from "@iorder/shared/server/pages/pages.contract";
import { useAdminPermissions } from "./ui/admin-permissions";
import { blockLabel, blockSummary } from "./page-blocks-editor";

const offeringBlockTypes = ["columns", "media_text", "features", "process", "grouped_list", "stats", "testimonials", "partners", "faq", "cta", "lead_form", "rich_text", "image", "video", "pricing", "collection_list"] as const satisfies readonly PageBlock["type"][];

type LinkItem = { title: string; href: string };

const inputClassName = "admin-input";
const labelClassName = "admin-field";
const summaryLimit = 200;


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

function offeringBlocksFromLegacy(offering: AdminOffering): PageBlock[] {
  if (offering.content.blocks) return offering.content.blocks;
  const content = offering.content;
  const blocks: PageBlock[] = [];
  function add(block: unknown) { blocks.push(pageBlockInputSchema.parse(block)); }
  if (content.description) add({ type: "media_text", isEnabled: true, appearance: content.appearance.overview, data: { layout: "image_right", tone: "light", eyebrow: "Tổng quan", title: "Tổng quan", description: content.description, bullets: [content.bestFor ? `Phù hợp với: ${content.bestFor}` : "", content.keyValue ? `Giá trị nổi bật: ${content.keyValue}` : ""].filter(Boolean), mediaId: offering.coverMediaId, primaryAction: null, secondaryAction: null } });
  if (content.features.length) add({ type: "features", isEnabled: true, data: { eyebrow: "Tính năng", title: "Tính năng chính", description: null, items: content.features.map((title) => ({ title, description: "", href: null })) } });
  if (content.benefits.length) add({ type: "features", isEnabled: true, appearance: content.appearance.benefits, data: { eyebrow: "Lợi ích", title: "Lợi ích mang lại", description: null, items: content.benefits.map((title) => ({ title, description: "", href: null })) } });
  if (content.pricing) add({ type: "pricing", isEnabled: true, appearance: content.appearance.pricing, data: content.pricing });
  if (content.faq.length) add({ type: "faq", isEnabled: true, data: { eyebrow: "Hỏi đáp", title: "Câu hỏi thường gặp", items: content.faq.map(([question, answer]) => ({ question, answer })) } });
  return blocks;
}

function offeringBlockText(blocks: PageBlock[]) {
  const hiddenKeys = new Set(["href", "mediaId", "backgroundMediaId", "icon", "type", "id", "tone", "layout", "isEnabled", "appearance"]);
  function flatten(value: unknown, key = ""): string[] {
    if (hiddenKeys.has(key)) return [];
    if (typeof value === "string") return value.trim() ? [value.trim()] : [];
    if (typeof value === "number") return [String(value)];
    if (Array.isArray(value)) return value.flatMap((item) => flatten(item));
    if (value && typeof value === "object") return Object.entries(value).flatMap(([childKey, child]) => flatten(child, childKey));
    return [];
  }
  return blocks.filter((block) => block.isEnabled).flatMap((block) => flatten(block.data)).join(" ");
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
  const canEdit = can(offering ? "offerings.update" : "offerings.create") && (canPublish || !["published", "scheduled"].includes(offering?.status ?? "draft"));
  const noun = offeringTypeLabel.toLocaleLowerCase("vi");
  const [form, setForm] = useState(() => offeringToForm(offering, offeringType));
  const [openBlock, setOpenBlock] = useState<number | null>(-1);
  const [blocksMigrated, setBlocksMigrated] = useState(false);
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
  const { isDirty, markSaved } = useUnsavedChanges(form);
  const needsBlocksMigration = Boolean(offering && offering.content.blocks === undefined && !blocksMigrated);
  const hasUnsavedChanges = isDirty || needsBlocksMigration;
  useEffect(() => onDirtyChange?.(hasUnsavedChanges), [hasUnsavedChanges, onDirtyChange]);
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
    if (!canEdit || saving.current || restore.pending.current) return;
    setForm((current) => ({ ...current, [field]: value }));
  }
  function changeTitle(title: string) {
    if (!canEdit || saving.current || restore.pending.current) return;
    setForm((current) => ({ ...current, title, ...(slugTouched ? {} : { slug: toSlug(title, 80) }) }));
  }
  function jumpToBlock(index: number) {
    setOpenBlock(index);
    requestAnimationFrame(() => document.getElementById(`page-block-${index}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || saving.current || uploading.current || restore.pending.current) return;
    if (!form.title.trim()) { setOpenBlock(-1); onError(`Nhập tên ${noun} ở phần đầu trang.`); return; }
    saving.current = true;
    setIsSaving(true);

    try {
      const payload = offeringFormToInput(form);
      const typeGuard = offeringType ? `?type=${offeringType}` : "";
      const result = await requestJson(offering ? `/api/v1/admin/offerings/${offering.id}${typeGuard}` : `/api/v1/admin/offerings${typeGuard}`, offering ? "PATCH" : "POST", offering ? { ...payload, expectedVersion: savedVersion } : payload) as { offering: AdminOffering };
      if (!result.offering || (offering && result.offering.id !== offering.id) || !Number.isSafeInteger(result.offering.draftVersion) || result.offering.draftVersion !== (savedVersion ?? 0) + 1) throw new Error("Phản hồi phiên bản nội dung không hợp lệ. Kiểm tra danh sách trước khi thử lại.");
      setSavedVersion(result.offering.draftVersion);
      markSaved();
      setBlocksMigrated(true);
      onSaved(result.offering, !offering);
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : `Không thể lưu ${noun}.`);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  const publicPath = `${offeringCatalogPaths[form.type] ?? ""}/${form.slug || "duong-dan"}`;
  // Trợ lý SEO đọc chữ trong các thành phần đang hiển thị; mô tả cũ tiếp tục làm dự phòng cho bản cũ.
  const seoText = [form.description, offeringBlockText(form.blocks)].filter(Boolean).join(" ");
  const seoContent = { blocks: [{ type: "paragraph", text: seoText }] };
  const checks = seoChecks({ title: form.title, seoTitle: form.seoTitle, seoDescription: form.seoDescription, excerpt: form.summary, slug: form.slug, hasCover: Boolean(form.coverMediaId), content: seoContent });
  const seoPassed = checks.filter((check) => check.ok).length;
  const savedStatus = offering?.status;
  const goingLive = form.status === "published" || form.status === "scheduled";
  const missing = [
    !form.coverMediaId ? { id: "offering-content", label: "Ảnh bìa" } : null,
    !form.summary.trim() ? { id: "offering-content", label: "Tóm tắt" } : null,
    !form.blocks.some((block) => block.isEnabled) ? { id: "offering-content", label: "Nội dung trang" } : null,
  ].filter((item): item is { id: string; label: string } => item !== null);

  // Phần đầu trang nằm trong trình dựng như mục số 1: tên, tóm tắt, ảnh bìa, nhãn nhóm, điểm nổi bật, thẻ.
  const heroDetail = <>
    <label className={labelClassName} data-field="title">Tên {noun}<input className={inputClassName} maxLength={220} onChange={(event) => changeTitle(event.target.value)} placeholder={`Nhập tên ${noun}…`} value={form.title} /></label>
        <div className={labelClassName} data-field="summary">
          <span className="admin-seo__label"><label htmlFor="offering-summary">Tóm tắt</label><span className={form.summary.trim().length > summaryLimit ? "admin-seo__count admin-seo__count--over" : "admin-seo__count"}>{form.summary.trim().length}/{summaryLimit} ký tự</span>{form.description.trim() && !form.summary.trim() ? <button className="admin-post-editor__link" onClick={() => update("summary", truncateAtWord(form.description, summaryLimit))} type="button">Lấy từ mô tả</button> : null}</span>
          <textarea className={inputClassName} id="offering-summary" onChange={(event) => update("summary", event.target.value)} placeholder="1–2 câu giới thiệu, hiện trên thẻ ở trang danh sách và khi chia sẻ Facebook/Zalo." rows={2} value={form.summary} />
        </div>
    <MediaPicker disabled={processing || !canEdit} preview hint="Hiện trên thẻ ở trang danh sách, đầu trang chi tiết và khi chia sẻ Facebook/Zalo. Nên dùng ảnh ngang 1200×630." label="Ảnh bìa" onChange={value => update("coverMediaId", value)} onUploadingChange={handleUploadingChange} value={form.coverMediaId} />
    <label className={labelClassName} data-field="category">Nhãn nhóm<input className={inputClassName} maxLength={180} onChange={(event) => update("category", event.target.value)} placeholder="Ví dụ: Quản lý bán hàng (dòng nhỏ phía trên tên)" value={form.category} /></label>
    <div className={labelClassName} data-field="metrics"><span>Điểm nổi bật</span><AdminListEditor addLabel="Thêm điểm nổi bật" itemLabel="Điểm nổi bật" items={form.metrics} maxItems={50} onChange={(items) => update("metrics", items)} placeholder="Ví dụ: 500+ nhà hàng đang dùng" /></div>
    <div className={labelClassName} data-field="tags"><span>Thẻ</span><AdminListEditor addLabel="Thêm thẻ" itemLabel="Thẻ" items={form.tags} maxItems={50} onChange={(items) => update("tags", items)} placeholder="Ví dụ: F&B" /></div>
    <label className={labelClassName} data-field="bestFor">Phù hợp với<input className={inputClassName} maxLength={500} onChange={(event) => update("bestFor", event.target.value)} placeholder="Ví dụ: Nhà hàng 10–50 bàn (hiện trong phần đầu trang)" value={form.bestFor} /></label>
    <label className={labelClassName} data-field="keyValue">Giá trị nổi bật<input className={inputClassName} maxLength={500} onChange={(event) => update("keyValue", event.target.value)} placeholder="Một câu nêu lợi ích lớn nhất (hiện trong phần đầu trang)" value={form.keyValue} /></label>
    <p className="admin-help">Đường dẫn: {publicPath}. Đổi ở mục “Đường dẫn trang” bên dưới.</p>
  </>;
  const heroLayoutDetail = <DetailHeroLayoutFields disabled={processing || !canEdit} name="offering-hero-layout" onChange={hero => update("appearance", { ...form.appearance, hero })} value={form.appearance.hero} />;
  const relatedLayoutDetail = <>
    <AppearanceEditor disabled={processing || !canEdit} onChange={patch => update("appearance", { ...form.appearance, related: { ...defaultAppearance, ...form.appearance.related, ...patch } })} onUploadingChange={handleUploadingChange} options={{ darkAllowed: true }} value={form.appearance.related} />
  </>;
  // Liên kết cuối trang: mục cố định cuối danh sách thành phần, hiện thành phần "Nội dung liên quan" phía dưới cùng.
  const relatedDetail = <>
    <p className="admin-help">Ví dụ: tài liệu, bảng giá, trang liên hệ. Để trống đường dẫn nếu chỉ muốn hiện chữ. Hiện ở cuối trang, sau các thành phần.</p>
    <OfferingLinksEditor items={form.items} onChange={(items) => update("items", items)} />
  </>;

  // Bản đồ nội dung đi theo đúng thứ tự các phần khách hàng đọc trên trang chi tiết.
  return (
    <form className="admin-post-editor admin-post-editor--with-outline" onSubmit={submit} ref={formRef}>
      {!canEdit ? <div className="col-span-full"><AdminNotice tone="info">Bạn chỉ có quyền xem nội dung này. Nội dung đang hiển thị cần thêm quyền xuất bản để sửa.</AdminNotice></div> : null}
      {processing ? <div className="col-span-full"><AdminNotice tone="info">{isSaving ? "Đang lưu nội dung. Các ô nhập tạm khóa cho tới khi lưu xong." : restore.restoring ? "Đang khôi phục phiên bản. Các ô nhập tạm khóa cho tới khi tải lại." : "Đang tải tệp lên. Các ô nhập tạm khóa cho tới khi tải xong."}</AdminNotice></div> : null}
      <fieldset disabled={processing} className="contents">
      <AdminEditorOutline key={offeringType ?? form.type} label="Bố cục trang" onSelect={(index) => jumpToBlock(index - 1)} items={[
        { step: 1, label: "Phần đầu trang", description: "Tên, tóm tắt, ảnh bìa", href: "#page-block--1" },
        ...form.blocks.map((block, index) => ({ step: index + 2, label: blockLabel(block.type), description: blockSummary(block), href: `#page-block-${index}` })),
      ]} />
      <div className="admin-post-editor__main">
        <AdminEditorSection description="Từ phần đầu trang đến các phần còn lại: chọn từng phần ở danh sách bên trái hoặc bấm trực tiếp trên trang xem trước để sửa. Đường dẫn và SEO nằm ở các mục bên dưới." id="offering-content" step={1} title="Nội dung trang">
          {needsBlocksMigration ? <p className="admin-help">Nội dung hiện tại sẽ được lưu thành các thành phần trang ở lần lưu tiếp theo. Ảnh bìa sẽ dùng cho phần Tổng quan; bạn có thể chọn ảnh khác ngay trong thành phần đó.</p> : null}
          <CmsPageBuilder readOnly={!canEdit} documentId={offering?.id ?? null} document={(() => { try { return { kind: "offering", values: offeringFormToInput(form) }; } catch { return null; } })()} allowedTypes={offeringBlockTypes} blocks={form.blocks} disabled={processing} leads={[{ label: "Phần đầu trang", detail: heroDetail, layoutDetail: heroLayoutDetail }]} tails={[{ label: "Nội dung liên quan", detail: relatedDetail, layoutDetail: relatedLayoutDetail }]} onChange={(blocks) => update("blocks", blocks)} onOpenIndexChange={setOpenBlock} onUploadingChange={handleUploadingChange} openIndex={openBlock} showGroupPicker />
        </AdminEditorSection>
        <AdminEditorSection description={`Địa chỉ không dấu của ${noun} trên website. Tên ở phần đầu trang tự tạo đường dẫn cho tới khi bạn sửa tay.`} id="offering-slug-section" title="Đường dẫn trang">
          {editingSlug ? <div className="admin-post-editor__slug-edit">
            <div className={labelClassName}><label className="admin-seo__label" htmlFor="offering-slug">Đường dẫn<span className="admin-help">Địa chỉ không dấu trên website: {publicPath}</span></label><span className="admin-post-editor__slug"><input autoFocus className={inputClassName} id="offering-slug" maxLength={180} onChange={(event) => { setSlugTouched(true); update("slug", event.target.value); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={form.slug} /><AdminButton disabled={!form.title.trim() || toSlug(form.title, 80) === form.slug} onClick={() => { setSlugTouched(true); update("slug", toSlug(form.title, 80)); }} size="sm" variant="secondary">Tạo từ tên</AdminButton><AdminButton onClick={() => setEditingSlug(false)} size="sm" variant="ghost">Xong</AdminButton></span></div>
            {savedStatus === "published" && form.status === "published" ? <small className="admin-help">{offeringTypeLabel} đang hiển thị: khi lưu với đường dẫn mới, đường dẫn cũ tự chuyển hướng (301) sang đường dẫn mới.</small> : savedStatus === "published" ? <small className="admin-help admin-text-warning">Sau lần lưu này nội dung chưa hiện ngay trên website nên đổi đường dẫn sẽ không tạo chuyển hướng từ đường dẫn cũ.</small> : <small className="admin-help">Chỉ dùng chữ thường không dấu, số và dấu gạch ngang.</small>}
          </div> : <p className="admin-post-editor__slug-line"><span className="admin-help">Đường dẫn:</span> <span className="admin-post-editor__path">{publicPath}</span><button className="admin-post-editor__link" onClick={() => setEditingSlug(true)} type="button">Sửa</button>{!slugTouched ? <span className="admin-help"> · tự tạo theo tên</span> : null}</p>}
        </AdminEditorSection>
        <details className="admin-post-editor__panel" id="offering-seo">
          <summary><span><strong>Google &amp; chia sẻ mạng xã hội</strong><small>Mặc định lấy từ tên và tóm tắt — chỉ mở khi muốn đặt riêng.</small></span><AdminStatusBadge tone={seoPassed === checks.length ? "success" : "warning"}>SEO {seoPassed}/{checks.length} đạt</AdminStatusBadge></summary>
          <div className="admin-post-editor__panel-body">
            <SeoAssistant content={seoContent} excerpt={form.summary} hasCover={Boolean(form.coverMediaId)} onChange={(field, value) => update(field, value)} path={publicPath} seoDescription={form.seoDescription} seoTitle={form.seoTitle} slug={form.slug} title={form.title} />
            <ContentSeoEditor value={form.seo} onChange={seo => update("seo", seo)} title={form.seoTitle || form.title} description={form.seoDescription || form.summary} disabled={processing || !canEdit} onUploadingChange={handleUploadingChange} />
            <label className={labelClassName}>Địa chỉ chính thức của nội dung (nâng cao)<input className={inputClassName} onChange={(event) => update("canonicalUrl", event.target.value)} placeholder="Chỉ điền khi nội dung này được sao chép từ một địa chỉ khác" type="url" value={form.canonicalUrl} /></label>
          </div>
        </details>
        {offering ? <details className="admin-post-editor__panel" onToggle={(event) => setHistoryOpen(event.currentTarget.open)}>
          <summary><span><strong>Lịch sử phiên bản</strong><small>Xem lại hoặc khôi phục bản đã lưu</small></span></summary>
          {historyOpen ? <div className="admin-post-editor__panel-body"><RevisionHistory target="offerings" id={offering.id} expectedVersion={savedVersion} disabled={hasUnsavedChanges || processing} onRestorePendingChange={restore.onPendingChange} onRestored={restore.onRestored} /></div> : null}
        </details> : null}
      </div>

      <aside aria-label={`Thiết lập ${noun}`} className="admin-post-editor__side">
        <section className="admin-content-section">
          <header className="admin-post-editor__card-head"><h3>Xuất bản</h3>{offering ? <PublishedPreviewLink contentType={offering.type} id={offering.id} kind="offering" slug={offering.slug} status={offering.status} /> : null}</header>
          {offering && hasUnsavedChanges ? <p className="admin-help">Xem trước hiển thị bản đã lưu — lưu trước để thấy thay đổi mới.</p> : null}
          {offering ? <p className="admin-post-editor__state"><AdminStatusBadge tone={contentStatusBadge[offering.status].tone}>{contentStatusBadge[offering.status].label}</AdminStatusBadge>{offering.publishedAt ? <small className="admin-help">Đăng lúc {formatDisplayDateTime(offering.publishedAt)}</small> : null}</p> : <p className="admin-help">{offeringTypeLabel} mới — chưa lưu.</p>}
          <ContentStatusChoice canPublish={canPublish} noun={noun} onChange={(status) => update("status", status)} savedStatus={savedStatus} value={form.status} />
          {form.status === "scheduled" ? <label className={labelClassName}>Thời điểm đăng<input className={inputClassName} onChange={(event) => update("scheduledAt", event.target.value)} required type="datetime-local" value={form.scheduledAt} /></label> : null}
          {goingLive ? <PrepublishHints missing={missing} /> : null}
        </section>
        <section className="admin-content-section">
          <header><h3>Hiển thị</h3></header>
          {offeringType ? null : <label className={labelClassName}>Nhóm nội dung<select className={inputClassName} onChange={(event) => update("type", event.target.value as typeof form.type)} value={form.type}><option value="software">Phần mềm</option><option value="solution">Giải pháp</option><option value="service">Dịch vụ</option></select></label>}
          <label className="admin-check"><input checked={form.isFeatured} onChange={(event) => update("isFeatured", event.target.checked)} type="checkbox" />Đánh dấu nổi bật</label>
          <label className={labelClassName}>Thứ tự trong danh sách<input className={inputClassName} max={10_000} min={0} onChange={(event) => update("sortOrder", Number(event.target.value))} type="number" value={form.sortOrder} /><small className="admin-help">Số nhỏ hiện trước.</small></label>
        </section>
      </aside>

      <AdminEditorActions><p className={hasUnsavedChanges ? "admin-help admin-text-warning" : "admin-help"} role="status">{isUploading ? "Đang tải ảnh nội dung…" : isSaving ? "Đang lưu…" : needsBlocksMigration ? "Nội dung cũ sẽ được chuyển thành thành phần khi lưu." : hasUnsavedChanges ? "Có thay đổi chưa lưu." : offering ? `Đã lưu · ${contentStatusBadge[offering.status].label}` : `${offeringTypeLabel} mới chưa lưu.`}</p><AdminButton disabled={isSaving || !canEdit} permission={offering ? "offerings.update" : "offerings.create"} title="Phím tắt: Ctrl+S" type="submit">{isSaving ? "Đang lưu…" : contentSubmitLabel(form.status, savedStatus, noun)}</AdminButton></AdminEditorActions>
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
    blocks: offering ? offeringBlocksFromLegacy(offering) : [],
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
    seo: offering?.seo ?? {},
  };
}

function offeringFormToInput(form: ReturnType<typeof offeringToForm>): AdminOfferingInput {
  const pricingBlock = form.blocks.find((block): block is Extract<PageBlock, { type: "pricing" }> => block.type === "pricing" && block.isEnabled);
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
      pricing: pricingBlock?.data ?? null,
      appearance: form.appearance,
      blocks: form.blocks,
    },
    icon: nullableText(form.icon),
    status: form.status,
    scheduledAt: dateTimeOrNull(form.scheduledAt),
    sortOrder: form.sortOrder,
    isFeatured: form.isFeatured,
    seoTitle: nullableText(form.seoTitle),
    seoDescription: nullableText(form.seoDescription),
    canonicalUrl: nullableText(form.canonicalUrl),
    seo: form.seo,
  };
}
