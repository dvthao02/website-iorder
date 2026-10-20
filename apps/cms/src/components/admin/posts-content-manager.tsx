"use client";
import { useAdminPermissions } from "./ui/admin-permissions";
import { requestAdminJson } from "@/lib/admin-api";
import { formatDisplayDateTime, formatLocalDateTime } from "@/lib/local-date-time";

import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MediaPicker } from "./media-picker";
import { RevisionHistory } from "./revision-history";
import { PublishedPreviewLink } from "./published-preview-link";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { AdminButton } from "./ui/admin-button";
import { AdminInlineCreate } from "./ui/admin-inline-create";
import { AdminNotice, AdminStatusBadge } from "./ui/admin-feedback";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useRevisionRestore } from "./ui/use-revision-restore";
import { SeoAssistant } from "./ui/seo-assistant";
import { contentPlainText, seoChecks, truncateAtWord } from "@iorder/core/server/shared/seo";
import { richFirstParagraph } from "@iorder/core/server/shared/rich-text";
import { toSlug } from "@/lib/slug";

import { postContentToRichDocument, type AdminPost, type PostContentDocument } from "@iorder/core/server/posts/posts.contract";
import { RichTextEditor } from "./rich-text/rich-text-editor";

type Notice = { kind: "error" | "success"; message: string } | undefined;
type PostStatus = AdminPost["status"];

// Trạng thái đã lưu (nhãn trên thanh bên) và nút lưu nói rõ sẽ làm gì với bài.
const statusBadge: Record<PostStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" }> = {
  draft: { label: "Bản nháp", tone: "neutral" },
  review: { label: "Chờ duyệt", tone: "warning" },
  scheduled: { label: "Đã hẹn giờ", tone: "info" },
  published: { label: "Đang hiển thị trên website", tone: "success" },
  archived: { label: "Đã lưu trữ", tone: "neutral" },
};
function submitLabel(status: PostStatus, savedStatus: PostStatus | undefined) {
  if (status === "published") return savedStatus === "published" ? "Cập nhật bài đã đăng" : "Xuất bản";
  if (status === "scheduled") return "Lên lịch đăng";
  if (status === "review") return "Gửi duyệt";
  if (status === "archived") return "Lưu trữ bài";
  return "Lưu nháp";
}

// Lựa chọn trạng thái có mô tả ngắn để người viết hiểu ngay hệ quả. "Lưu trữ" chỉ hiện khi bài đang lưu trữ
// (gỡ bài làm từ danh sách). Người thiếu quyền xuất bản không chọn được "Đăng ngay"/"Hẹn giờ".
function StatusChoice({ value, savedStatus, canPublish, onChange }: { value: PostStatus; savedStatus: PostStatus | undefined; canPublish: boolean; onChange: (status: PostStatus) => void }) {
  const choices: Array<{ status: PostStatus; label: string; hint: string }> = [
    { status: "draft", label: "Bản nháp", hint: "Chỉ người quản trị thấy." },
    { status: "review", label: "Chờ duyệt", hint: "Gửi người có quyền xuất bản xem lại." },
    { status: "published", label: savedStatus === "published" ? "Đang hiển thị" : "Đăng ngay", hint: savedStatus === "published" ? "Giữ bài trên website, cập nhật nội dung mới." : "Hiện trên website ngay khi lưu." },
    { status: "scheduled", label: "Hẹn giờ đăng", hint: "Tự hiện trên website vào thời điểm chọn." },
    ...(value === "archived" || savedStatus === "archived" ? [{ status: "archived" as const, label: "Lưu trữ", hint: "Đã gỡ khỏi website." }] : []),
  ];
  const isLocked = (status: PostStatus) => !canPublish && (status === "published" || status === "scheduled") && status !== savedStatus;
  const active = choices.find((choice) => choice.status === value);
  return <fieldset className="admin-status-choice"><legend>Trạng thái</legend>
    <div className="admin-status-choice__grid">{choices.map((choice) => <label className={value === choice.status ? "admin-status-choice__item admin-status-choice__item--active" : "admin-status-choice__item"} key={choice.status} title={isLocked(choice.status) ? "Cần quyền xuất bản" : choice.hint}>
      <input checked={value === choice.status} disabled={isLocked(choice.status)} name="post-status" onChange={() => onChange(choice.status)} type="radio" value={choice.status} />
      <span>{choice.label}</span>
    </label>)}</div>
    {active ? <p className="admin-help">{active.hint}</p> : null}
    {!canPublish ? <p className="admin-help">Đăng ngay và hẹn giờ cần quyền xuất bản.</p> : null}
  </fieldset>;
}

// Đưa người dùng tới đúng ô còn thiếu (cuộn tới giữa màn và đặt con trỏ vào).
function focusField(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  // Ưu tiên vùng soạn thảo, rồi tới ô nhập/nút đầu tiên trong khu vực.
  const focusable = element.matches("input, textarea, select, button") ? element : element.querySelector<HTMLElement>("[contenteditable=true]") ?? element.querySelector<HTMLElement>("input, textarea, button");
  focusable?.focus({ preventScroll: true });
}

const inputClassName = "admin-input";
const labelClassName = "admin-field";

function EditorSection({ children, description, title }: { children: ReactNode; description?: string; title: string }) {
  return <section className="admin-content-section"><header><h3>{title}</h3>{description ? <p>{description}</p> : null}</header>{children}</section>;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function dateTimeInputValue(value: Date | null) {
  return formatLocalDateTime(value);
}

function dateTimeOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function postToForm(post: AdminPost | undefined, defaultType: AdminPost["type"] = "news") {
  return {
    coverMediaId: post?.coverMediaId ?? null,
    type: post?.type ?? defaultType,
    status: post?.status ?? "draft",
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    // Luôn soạn ở định dạng v2; bài cũ (v1) được chuyển ngay khi mở.
    content: (post ? { version: 2, doc: postContentToRichDocument(post.content) } : { version: 2, doc: { type: "doc", content: [{ type: "paragraph" }] } }) as PostContentDocument,
    seoTitle: post?.seoTitle ?? "",
    seoDescription: post?.seoDescription ?? "",
    canonicalUrl: post?.canonicalUrl ?? "",
    promotionStartAt: dateTimeInputValue(post?.promotionStartAt ?? null),
    promotionEndAt: dateTimeInputValue(post?.promotionEndAt ?? null),
    ctaLabel: post?.ctaLabel ?? "",
    ctaUrl: post?.ctaUrl ?? "",
    badgeText: post?.badgeText ?? "",
    scheduledAt: dateTimeInputValue(post?.scheduledAt ?? null),
    categoryIds: post?.categoryIds ?? [],
    tagIds: post?.tagIds ?? [],
  };
}

function formToPayload(form: ReturnType<typeof postToForm>) {
  return {
    coverMediaId: form.coverMediaId,
    type: form.type,
    status: form.status,
    title: form.title,
    slug: form.slug,
    excerpt: nullableText(form.excerpt),
    content: form.content,
    seoTitle: nullableText(form.seoTitle),
    seoDescription: nullableText(form.seoDescription),
    canonicalUrl: nullableText(form.canonicalUrl),
    promotionStartAt: dateTimeOrNull(form.promotionStartAt),
    promotionEndAt: dateTimeOrNull(form.promotionEndAt),
    ctaLabel: nullableText(form.ctaLabel),
    ctaUrl: nullableText(form.ctaUrl),
    badgeText: nullableText(form.badgeText),
    scheduledAt: dateTimeOrNull(form.scheduledAt),
    categoryIds: form.categoryIds,
    tagIds: form.tagIds,
  };
}

async function requestJson(url: string, method: "PATCH" | "POST", body: unknown) {
  return await requestAdminJson(url, method, body, "Không thể lưu bài viết. Vui lòng thử lại.") as { post: AdminPost };
}

function TaxonomyChecklist({ emptyText, items, onChange, selected, searchLabel }: { emptyText: string; items: Array<{ id: string; name: string }>; onChange: (ids: string[]) => void; selected: string[]; searchLabel: string }) {
  const [filter, setFilter] = useState("");
  if (!items.length) return <p className="admin-help">{emptyText}</p>;
  const keyword = filter.trim().toLocaleLowerCase("vi");
  const shown = keyword ? items.filter((item) => selected.includes(item.id) || item.name.toLocaleLowerCase("vi").includes(keyword)) : items;
  return <>{items.length > 8 ? <input aria-label={searchLabel} className="admin-input admin-post-editor__filter" onChange={(event) => setFilter(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder={`${searchLabel}…`} type="search" value={filter} /> : null}<div className="admin-post-editor__checklist">{shown.length ? null : <p className="admin-help">Không tìm thấy.</p>}{shown.map((item) => <label className="admin-post-editor__check" key={item.id}><input checked={selected.includes(item.id)} onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} type="checkbox" />{item.name}</label>)}</div></>;
}

export type PostTaxonomy = { categories: Array<{ id: string; name: string }>; tags: Array<{ id: string; name: string }> };
type Taxonomy = PostTaxonomy;
export function PostsContentManager({ initialPosts, taxonomy }: { initialPosts: AdminPost[]; taxonomy: Taxonomy }) {
  const searchParams = useSearchParams();
  const requestedPostId = searchParams.get("edit");
  const [posts, setPosts] = useState(initialPosts);
  const [activePostId, setActivePostId] = useState<string | undefined>(() => initialPosts.some(post => post.id === requestedPostId) ? requestedPostId ?? undefined : initialPosts[0]?.id);
  const [isCreating, setIsCreating] = useState(() => searchParams.get("create") === "1");
  const [notice, setNotice] = useState<Notice>();
  const activePost = posts.find((post) => post.id === activePostId);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="admin-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2>Bài viết</h2>
          <button className="admin-button admin-button--primary" onClick={() => { setIsCreating(true); setActivePostId(undefined); }} type="button">Thêm mới</button>
        </div>
        <div className="grid gap-2">
          {posts.map((post) => (
            <button className={`rounded-[var(--cms-radius-card)] px-3 py-3 text-left text-sm transition ${post.id === activePostId && !isCreating ? "bg-[var(--cms-primary-soft)] text-[var(--cms-primary)]" : "hover:bg-[var(--cms-hover)]"}`} key={post.id} onClick={() => { setActivePostId(post.id); setIsCreating(false); }} type="button">
              <span className="block font-medium">{post.title}</span>
              <span className="admin-field__hint block">{post.type} · {post.status} · v{post.draftVersion}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="admin-card">
        {notice ? <AdminNotice tone={notice.kind}>{notice.message}</AdminNotice> : null}
        {isCreating || activePost ? (
          <PostEditor
            key={activePost?.id ?? "new"}
            post={activePost}
            taxonomy={taxonomy}
            onError={(message) => setNotice({ kind: "error", message })}
            onSaved={(post, created) => {
              setPosts((current) => created ? [post, ...current] : current.map((item) => item.id === post.id ? post : item));
              setActivePostId(post.id);
              setIsCreating(false);
              setNotice({ kind: "success", message: created ? "Đã tạo bài viết và lưu revision đầu tiên." : "Đã lưu bài viết và tạo revision mới." });
            }}
          />
        ) : <p className="admin-text-muted">Chưa có bài viết nào. Chọn “Thêm mới” để bắt đầu.</p>}
      </section>
    </div>
  );
}

export function PostEditor({ post, taxonomy, onSaved, onError, contentType, onDirtyChange }: {
  post: AdminPost | undefined;
  taxonomy: Taxonomy;
  onSaved: (post: AdminPost, created: boolean) => void;
  onError: (message: string) => void;
  contentType?: AdminPost["type"];
  onDirtyChange?: (isDirty: boolean) => void;
}) {
  const [form, setForm] = useState(() => postToForm(post, contentType));
  const [savedVersion, setSavedVersion] = useState(post?.draftVersion);
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
  useNavigationGuard(processing && !restore.completing, () => onError("Đang xử lý bài viết. Vui lòng chờ trước khi rời màn hình."));
  const [editingSlug, setEditingSlug] = useState(false);
  const [displayOptionsOpen] = useState(() => Boolean(post?.badgeText || post?.ctaLabel || post?.ctaUrl || post?.type === "promotion"));
  const formRef = useRef<HTMLFormElement>(null);
  // Ctrl+S / ⌘+S lưu ngay, không phải cuộn xuống thanh lưu.
  useEffect(() => {
    function save(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); formRef.current?.requestSubmit(); }
    }
    window.addEventListener("keydown", save);
    return () => window.removeEventListener("keydown", save);
  }, []);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Bài mới: slug tự theo tiêu đề cho tới khi người dùng tự sửa slug. Bài đã có giữ slug (đổi slug làm hỏng liên kết).
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const publicPath = `${form.type === "guide" ? "/ho-tro/cai-dat" : "/tin-tuc"}/${form.slug || "duong-dan"}`;
  function changeTitle(title: string) {
    if (saving.current || restore.pending.current) return;
    setForm((current) => ({ ...current, title, ...(slugTouched ? {} : { slug: toSlug(title, 80) }) }));
  }
  const canPublish = useAdminPermissions().can("posts.publish");
  const { isDirty, markSaved } = useUnsavedChanges(form);
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  function update<Field extends keyof typeof form>(field: Field, value: (typeof form)[Field]) {
    if (saving.current || restore.pending.current) return;
    setForm((current) => ({ ...current, [field]: value }));
  }
  // Chuyên mục/thẻ vừa tạo ngay trong editor: hiện luôn trong danh sách mà không cần tải lại trang.
  const [createdTaxonomy, setCreatedTaxonomy] = useState<PostTaxonomy>({ categories: [], tags: [] });
  const categories = [...taxonomy.categories, ...createdTaxonomy.categories.filter((item) => !taxonomy.categories.some((existing) => existing.id === item.id))];
  const tags = [...taxonomy.tags, ...createdTaxonomy.tags.filter((item) => !taxonomy.tags.some((existing) => existing.id === item.id))];
  async function createTaxonomy(kind: "categories" | "tags", name: string, slug: string) {
    const values = kind === "categories" ? { parentId: null, name, slug, description: null, sortOrder: 0 } : { name, slug };
    const payload = await requestAdminJson("/api/admin/taxonomy", "POST", { kind, id: null, values }, kind === "categories" ? "Không thể tạo chuyên mục." : "Không thể tạo thẻ.");
    const id = payload && typeof payload === "object" && "id" in payload && typeof payload.id === "string" ? payload.id : null;
    if (!id) throw new Error("Phản hồi tạo phân loại không hợp lệ.");
    setCreatedTaxonomy((current) => ({ ...current, [kind]: [...current[kind], { id, name }] }));
    const field = kind === "categories" ? "categoryIds" : "tagIds";
    setForm((current) => ({ ...current, [field]: [...current[field], id] }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || uploading.current || restore.pending.current) return;
    saving.current = true;
    setIsSaving(true);

    try {
      const payload = formToPayload(form);
      const result = await requestJson(post ? `/api/admin/posts/${post.id}` : "/api/admin/posts", post ? "PATCH" : "POST", post ? { ...payload, expectedVersion: savedVersion } : payload);
      if (!result.post || (post && result.post.id !== post.id) || !Number.isSafeInteger(result.post.draftVersion) || result.post.draftVersion !== (savedVersion ?? 0) + 1) throw new Error("Phản hồi phiên bản bài viết không hợp lệ. Kiểm tra danh sách trước khi thử lại.");
      setSavedVersion(result.post.draftVersion);
      markSaved();
      onSaved(result.post, !post);
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : "Không thể lưu bài viết.");
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  const checks = seoChecks({ title: form.title, seoTitle: form.seoTitle, seoDescription: form.seoDescription, excerpt: form.excerpt, slug: form.slug, hasCover: Boolean(form.coverMediaId), content: form.content });
  const seoPassed = checks.filter((check) => check.ok).length;
  const savedStatus = post?.status;
  const wordCount = contentPlainText(form.content).split(/\s+/).filter(Boolean).length;
  const firstParagraph = form.content.version === 2 ? richFirstParagraph(form.content.doc) : null;
  // Gợi ý (không chặn) trước khi đăng; bấm để tới đúng chỗ.
  const goingLive = form.status === "published" || form.status === "scheduled";
  const missing = [
    !form.coverMediaId ? { id: "post-cover", label: "Ảnh bìa" } : null,
    !form.excerpt.trim() ? { id: "post-excerpt", label: "Tóm tắt" } : null,
    !form.categoryIds.length ? { id: "post-categories", label: "Chuyên mục" } : null,
    wordCount < 150 ? { id: "post-content", label: `Nội dung dài hơn (hiện ${wordCount} từ)` } : null,
  ].filter((item): item is { id: string; label: string } => item !== null);

  // Bố cục 2 cột: trái để viết (tiêu đề → nội dung → tóm tắt → SEO), phải là thiết lập luôn nhìn thấy.
  return (
    <form className="admin-post-editor" onSubmit={submit} ref={formRef}>
      <fieldset disabled={processing} className="contents">
      <div className="admin-post-editor__main">
        <section className="admin-content-section admin-post-editor__writing" id="post-content">
          <label className="admin-post-editor__title-field"><span className="sr-only">Tiêu đề</span><input className="admin-post-editor__title" onChange={(event) => changeTitle(event.target.value)} placeholder="Nhập tiêu đề bài viết…" required value={form.title} /></label>
          {editingSlug ? <div className="admin-post-editor__slug-edit">
            <div className={labelClassName}><label className="admin-seo__label" htmlFor="post-slug">Đường dẫn (slug)<span className="admin-help">{publicPath}</span></label><span className="admin-post-editor__slug"><input autoFocus className={inputClassName} id="post-slug" onChange={(event) => { setSlugTouched(true); update("slug", event.target.value); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={form.slug} /><AdminButton disabled={!form.title.trim() || toSlug(form.title, 80) === form.slug} onClick={() => { setSlugTouched(true); update("slug", toSlug(form.title, 80)); }} size="sm" variant="secondary">Tạo từ tiêu đề</AdminButton><AdminButton onClick={() => setEditingSlug(false)} size="sm" variant="ghost">Xong</AdminButton></span></div>
            {savedStatus === "published" ? <small className="admin-help admin-text-warning">Bài đã xuất bản: đổi đường dẫn sẽ làm hỏng liên kết cũ, nên tạo chuyển hướng.</small> : <small className="admin-help">Chỉ dùng chữ thường không dấu, số và dấu gạch ngang.</small>}
          </div> : <p className="admin-post-editor__slug-line"><span className="admin-help">Đường dẫn:</span> <span className="admin-post-editor__path">{publicPath}</span><button className="admin-post-editor__link" onClick={() => setEditingSlug(true)} type="button">Sửa</button>{!slugTouched ? <span className="admin-help"> · tự tạo theo tiêu đề</span> : null}</p>}
          <RichTextEditor disabled={processing} onChange={(richDoc) => update("content", { version: 2, doc: richDoc })} onImportTitle={(title) => { if (!form.title.trim()) changeTitle(title); }} placeholder="Viết nội dung bài… Dùng Tiêu đề H2/H3 để chia mục, website tự tạo mục lục." value={form.content.version === 2 ? form.content.doc : postContentToRichDocument(form.content)} />
        </section>
        <EditorSection description="1–2 câu giới thiệu. Hiện ở danh sách tin, khi chia sẻ Facebook/Zalo và làm đoạn mô tả trên Google." title="Tóm tắt"><div className="admin-seo__label"><span className={form.excerpt.trim().length > 200 ? "admin-seo__count admin-seo__count--over" : "admin-seo__count"}>{form.excerpt.trim().length}/200 ký tự</span>{firstParagraph ? <button className="admin-post-editor__link" onClick={() => update("excerpt", truncateAtWord(firstParagraph, 200))} type="button">Lấy từ đoạn đầu bài</button> : null}</div><label className={labelClassName}><span className="sr-only">Tóm tắt</span><textarea className={inputClassName} id="post-excerpt" onChange={(event) => update("excerpt", event.target.value)} placeholder="Ví dụ: Danh mục sản phẩm, bảng giá và tài khoản nhân viên là những phần nên chuẩn bị trước khi triển khai." rows={3} value={form.excerpt} /></label></EditorSection>
        <details className="admin-post-editor__panel">
          <summary><span><strong>Google &amp; chia sẻ mạng xã hội</strong><small>Mặc định lấy từ tiêu đề và tóm tắt — chỉ mở khi muốn đặt riêng.</small></span><AdminStatusBadge tone={seoPassed === checks.length ? "success" : "warning"}>SEO {seoPassed}/{checks.length} đạt</AdminStatusBadge></summary>
          <div className="admin-post-editor__panel-body">
            <SeoAssistant content={form.content} excerpt={form.excerpt} hasCover={Boolean(form.coverMediaId)} onChange={(field, value) => update(field, value)} path={publicPath} seoDescription={form.seoDescription} seoTitle={form.seoTitle} slug={form.slug} title={form.title} />
            <label className={labelClassName}>URL chuẩn (canonical)<input className={inputClassName} onChange={(event) => update("canonicalUrl", event.target.value)} placeholder="https://… — chỉ điền khi bài này là bản sao của trang khác" type="url" value={form.canonicalUrl} /></label>
          </div>
        </details>
        {/* Phần ít dùng đặt cuối cột viết để hai cột cân nhau. */}
        <details className="admin-post-editor__panel" open={displayOptionsOpen}>
          <summary><span><strong>Nhãn &amp; nút kêu gọi hành động</strong><small>Không bắt buộc</small></span></summary>
          <div className="admin-post-editor__panel-body">
            <label className={labelClassName}>Nhãn nổi bật<input className={inputClassName} onChange={(event) => update("badgeText", event.target.value)} placeholder="Ví dụ: Mới" value={form.badgeText} /></label>
            <label className={labelClassName}>Chữ trên nút<input className={inputClassName} onChange={(event) => update("ctaLabel", event.target.value)} placeholder="Ví dụ: Đăng ký tư vấn" value={form.ctaLabel} /></label>
            <label className={labelClassName}>Nút dẫn tới<input className={inputClassName} onChange={(event) => update("ctaUrl", event.target.value)} placeholder="https://…" type="url" value={form.ctaUrl} /></label>
            {form.type === "promotion" ? <><label className={labelClassName}>Bắt đầu khuyến mãi<input className={inputClassName} onChange={(event) => update("promotionStartAt", event.target.value)} type="datetime-local" value={form.promotionStartAt} /></label><label className={labelClassName}>Kết thúc khuyến mãi<input className={inputClassName} onChange={(event) => update("promotionEndAt", event.target.value)} type="datetime-local" value={form.promotionEndAt} /></label></> : null}
          </div>
        </details>
        {post ? <details className="admin-post-editor__panel" onToggle={(event) => setHistoryOpen(event.currentTarget.open)}>
          <summary><span><strong>Lịch sử phiên bản</strong><small>Xem lại hoặc khôi phục bản đã lưu</small></span></summary>
          {historyOpen ? <div className="admin-post-editor__panel-body"><RevisionHistory target="posts" id={post.id} expectedVersion={savedVersion} disabled={isDirty || processing} onRestorePendingChange={restore.onPendingChange} onRestored={restore.onRestored} /></div> : null}
        </details> : null}
      </div>

      <aside aria-label="Thiết lập bài viết" className="admin-post-editor__side">
        <section className="admin-content-section">
          <header className="admin-post-editor__card-head"><h3>Xuất bản</h3>{post ? <PublishedPreviewLink contentType={post.type} id={post.id} kind="post" slug={post.slug} status={post.status} /> : null}</header>
          {post && isDirty ? <p className="admin-help">Xem trước hiển thị bản đã lưu — lưu trước để thấy thay đổi mới.</p> : null}
          {post ? <p className="admin-post-editor__state"><AdminStatusBadge tone={statusBadge[post.status].tone}>{statusBadge[post.status].label}</AdminStatusBadge>{post.publishedAt ? <small className="admin-help">Đăng lúc {formatDisplayDateTime(post.publishedAt)}</small> : null}</p> : <p className="admin-help">Bài mới — chưa lưu.</p>}
          <StatusChoice canPublish={canPublish} onChange={(status) => update("status", status)} savedStatus={savedStatus} value={form.status} />
          {form.status === "scheduled" ? <label className={labelClassName}>Thời điểm đăng<input className={inputClassName} onChange={(event) => update("scheduledAt", event.target.value)} required type="datetime-local" value={form.scheduledAt} /></label> : null}
          {goingLive ? missing.length ? <div className="admin-post-editor__prepublish" role="note"><strong>Nên có trước khi đăng</strong><ul>{missing.map((item) => <li key={item.id}><button className="admin-post-editor__link" onClick={() => focusField(item.id)} type="button">{item.label}</button></li>)}</ul></div> : <p className="admin-post-editor__ready">Đã đủ thông tin để đăng.</p> : null}
        </section>
        <section className="admin-content-section" id="post-cover">
          <MediaPicker preview hint="Hiện ở đầu bài, thẻ tin và khi chia sẻ Facebook/Zalo. Nên dùng ảnh ngang 1200×630." label="Ảnh bìa" onChange={value => update("coverMediaId", value)} onUploadingChange={handleUploadingChange} value={form.coverMediaId} />
        </section>
        <section className="admin-content-section">
          <header><h3>Phân loại</h3></header>
          <label className={labelClassName}>Loại bài viết<select className={inputClassName} disabled={Boolean(contentType)} onChange={(event) => update("type", event.target.value as typeof form.type)} value={form.type}><option value="news">Tin tức</option><option value="promotion">Khuyến mãi</option><option value="case_study">Câu chuyện khách hàng</option><option value="announcement">Thông báo</option>{contentType === "guide" ? <option value="guide">Hướng dẫn</option> : null}</select></label>
          <fieldset className="admin-post-editor__group" id="post-categories"><legend>Chuyên mục</legend><TaxonomyChecklist emptyText="Chưa có chuyên mục." searchLabel="Tìm chuyên mục" items={categories} onChange={(ids) => update("categoryIds", ids)} selected={form.categoryIds} /><AdminInlineCreate disabled={processing} label="chuyên mục" onCreate={(name, slug) => createTaxonomy("categories", name, slug)} permission="taxonomy.create" /></fieldset>
          <fieldset className="admin-post-editor__group"><legend>Thẻ</legend><TaxonomyChecklist emptyText="Chưa có thẻ nào." searchLabel="Tìm thẻ" items={tags} onChange={(ids) => update("tagIds", ids)} selected={form.tagIds} /><AdminInlineCreate disabled={processing} label="thẻ" onCreate={(name, slug) => createTaxonomy("tags", name, slug)} permission="taxonomy.create" /></fieldset>
        </section>
      </aside>

      <AdminEditorActions><p className={isDirty ? "admin-help admin-text-warning" : "admin-help"} role="status">{isDirty ? "Có thay đổi chưa lưu." : post ? `Đã lưu · ${statusBadge[post.status].label}` : "Bài mới chưa lưu."}</p><AdminButton disabled={isSaving} permission={post ? "posts.update" : "posts.create"} title="Phím tắt: Ctrl+S" type="submit">{isSaving ? "Đang lưu..." : submitLabel(form.status, savedStatus)}</AdminButton></AdminEditorActions>
      </fieldset>
    </form>
  );
}
