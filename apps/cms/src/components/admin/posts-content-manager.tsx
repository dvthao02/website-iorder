"use client";
import { useAdminPermissions } from "./ui/admin-permissions";
import { requestAdminJson } from "@/lib/admin-api";
import { formatLocalDateTime } from "@/lib/local-date-time";

import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MediaPicker } from "./media-picker";
import { RevisionHistory } from "./revision-history";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { AdminEditorTabs } from "./ui/admin-editor-tabs";
import { PublishPermissionHint, PublishStatusOptions } from "./ui/publish-status-options";
import { AdminButton } from "./ui/admin-button";
import { AdminInlineCreate } from "./ui/admin-inline-create";
import { AdminNotice } from "./ui/admin-feedback";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useRevisionRestore } from "./ui/use-revision-restore";

import type { AdminPost, PostContentDocument } from "@iorder/core/server/posts/posts.contract";

type Notice = { kind: "error" | "success"; message: string } | undefined;

const inputClassName = "admin-input";
const labelClassName = "admin-field";
type PostBlock = PostContentDocument["blocks"][number];

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

function movePostBlock(blocks: PostBlock[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return blocks;
  const result = [...blocks];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

function PostDocumentEditor({ document, onChange }: { document: PostContentDocument; onChange: (document: PostContentDocument) => void }) {
  const blocks = document.blocks;
  function update(index: number, next: PostBlock) { onChange({ ...document, blocks: blocks.map((block, blockIndex) => blockIndex === index ? next : block) }); }
  return <div className="admin-post-document-editor grid gap-3">
    {blocks.map((block, index) => <article className="admin-post-document-editor__block admin-subsection" key={index}>
      <div className="flex flex-wrap items-center justify-between gap-3"><strong className="text-sm">Khối {index + 1}: {block.type === "paragraph" ? "Đoạn văn" : "Danh sách kiểm tra"}</strong><div className="admin-post-document-editor__actions"><button type="button" disabled={index === 0} onClick={() => onChange({ ...document, blocks: movePostBlock(blocks, index, -1) })}>Lên</button><button type="button" disabled={index === blocks.length - 1} onClick={() => onChange({ ...document, blocks: movePostBlock(blocks, index, 1) })}>Xuống</button><button type="button" className="admin-post-document-editor__danger" onClick={() => onChange({ ...document, blocks: blocks.filter((_, blockIndex) => blockIndex !== index) })}>Xóa</button></div></div>
      {block.type === "paragraph" ? <label className={labelClassName}>Nội dung<textarea className={inputClassName} required rows={7} value={block.text} onChange={event => update(index, { ...block, text: event.target.value })} /></label> : <><label className={labelClassName}>Tiêu đề danh sách<input className={inputClassName} required value={block.heading} onChange={event => update(index, { ...block, heading: event.target.value })} /></label><div className="grid gap-2">{block.items.map((item, itemIndex) => <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" key={itemIndex}><input className={inputClassName} required value={item} onChange={event => update(index, { ...block, items: block.items.map((entry, entryIndex) => entryIndex === itemIndex ? event.target.value : entry) })} /><button type="button" className="admin-post-document-editor__danger" onClick={() => update(index, { ...block, items: block.items.filter((_, entryIndex) => entryIndex !== itemIndex) })}>Xóa mục</button></div>)}</div><button type="button" className="admin-post-document-editor__add" onClick={() => update(index, { ...block, items: [...block.items, "Mục mới"] })}>+ Thêm mục</button></>}</article>)}
    <div className="flex flex-wrap gap-2"><button type="button" className="admin-post-document-editor__add" onClick={() => onChange({ ...document, blocks: [...blocks, { type: "paragraph", text: "Nội dung mới" }] })}>+ Thêm đoạn văn</button><button type="button" className="admin-post-document-editor__add" onClick={() => onChange({ ...document, blocks: [...blocks, { type: "checklist", heading: "Danh sách mới", items: ["Mục mới"] }] })}>+ Thêm danh sách</button></div>
  </div>;
}

function postToForm(post: AdminPost | undefined, defaultType: AdminPost["type"] = "news") {
  return {
    coverMediaId: post?.coverMediaId ?? null,
    type: post?.type ?? defaultType,
    status: post?.status ?? "draft",
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    content: post?.content ?? { version: 1, blocks: [{ type: "paragraph", text: "Nội dung mới" }] },
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

function TaxonomyChecklist({ emptyText, items, onChange, selected }: { emptyText: string; items: Array<{ id: string; name: string }>; onChange: (ids: string[]) => void; selected: string[] }) {
  if (!items.length) return <p className="admin-help">{emptyText}</p>;
  return <>{items.map((item) => <label className="admin-post-editor__check" key={item.id}><input checked={selected.includes(item.id)} onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} type="checkbox" />{item.name}</label>)}</>;
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
  const [activeTab, setActiveTab] = useState("basic");
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

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <fieldset disabled={processing} className="contents">
      <AdminEditorTabs activeId={activeTab} onChange={setActiveTab} tabs={[{ id: "basic", label: "Thông tin" }, { id: "content", label: "Nội dung" }, { id: "publishing", label: "Xuất bản & SEO" }, ...(post ? [{ id: "history", label: "Lịch sử" }] : [])]} />

      {activeTab === "basic" ? <div className="grid gap-4">
      <EditorSection description="Thông tin nhận diện và đường dẫn dùng cho bài viết." title="Thông tin cơ bản"><div className="admin-form-grid">
        <label className={labelClassName}>Loại bài viết<select className={inputClassName} disabled={Boolean(contentType)} onChange={(event) => update("type", event.target.value as typeof form.type)} value={form.type}><option value="news">Tin tức</option><option value="promotion">Khuyến mãi</option><option value="case_study">Câu chuyện khách hàng</option><option value="announcement">Thông báo</option>{contentType === "guide" ? <option value="guide">Hướng dẫn</option> : null}</select></label>
        <label className={labelClassName}>Tiêu đề<input className={inputClassName} onChange={(event) => update("title", event.target.value)} required value={form.title} /></label>
        <label className={labelClassName}>Slug<input className={inputClassName} onChange={(event) => update("slug", event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={form.slug} /></label>
      </div></EditorSection>

      <EditorSection description="Ảnh đại diện hiển thị trong danh sách tin và trang chi tiết." title="Media"><MediaPicker value={form.coverMediaId} onChange={value => update("coverMediaId", value)} onUploadingChange={handleUploadingChange} /></EditorSection>
      <EditorSection description="Chọn các nhóm giúp người đọc tìm bài viết trong trang tin." title="Phân loại"><div className="admin-form-grid"><fieldset className="grid gap-3"><legend className="admin-field mb-2">Chuyên mục</legend><TaxonomyChecklist emptyText="Chưa có chuyên mục." items={categories} onChange={(ids) => update("categoryIds", ids)} selected={form.categoryIds} /><AdminInlineCreate disabled={processing} label="chuyên mục" onCreate={(name, slug) => createTaxonomy("categories", name, slug)} permission="taxonomy.create" /></fieldset><fieldset className="grid gap-3"><legend className="admin-field mb-2">Thẻ</legend><TaxonomyChecklist emptyText="Chưa có thẻ." items={tags} onChange={(ids) => update("tagIds", ids)} selected={form.tagIds} /><AdminInlineCreate disabled={processing} label="thẻ" onCreate={(name, slug) => createTaxonomy("tags", name, slug)} permission="taxonomy.create" /></fieldset></div></EditorSection>
      </div> : null}

      {activeTab === "content" ? <div className="grid gap-4"><EditorSection description="Phần tóm tắt hiển thị ở danh sách tin và khi chia sẻ liên kết." title="Tóm tắt"><label className={labelClassName}>Tóm tắt<textarea className={inputClassName} onChange={(event) => update("excerpt", event.target.value)} rows={4} value={form.excerpt} /></label></EditorSection><EditorSection description="Sắp xếp các khối theo đúng thứ tự muốn xuất hiện trên website." title="Nội dung bài viết"><PostDocumentEditor document={form.content} onChange={content => update("content", content)} /></EditorSection></div> : null}

      {activeTab === "publishing" ? <div className="grid gap-4"><EditorSection title="Xuất bản"><div className="admin-form-grid"><label className={labelClassName}>Trạng thái<select className={inputClassName} onChange={(event) => update("status", event.target.value as typeof form.status)} value={form.status}><PublishStatusOptions canPublish={canPublish} current={form.status} /></select></label><PublishPermissionHint canPublish={canPublish} />{form.status === "scheduled" ? <label className={labelClassName}>Thời điểm hẹn giờ<input className={inputClassName} onChange={(event) => update("scheduledAt", event.target.value)} type="datetime-local" value={form.scheduledAt} /></label> : null}</div></EditorSection><EditorSection description="Thông tin dành cho công cụ tìm kiếm, liên kết chia sẻ và lời kêu gọi hành động." title="SEO & hiển thị"><div className="admin-form-grid">
        <label className={labelClassName}>Tiêu đề SEO<input className={inputClassName} onChange={(event) => update("seoTitle", event.target.value)} value={form.seoTitle} /></label>
        <label className={labelClassName}>Mô tả SEO<input className={inputClassName} onChange={(event) => update("seoDescription", event.target.value)} value={form.seoDescription} /></label>
        <label className={labelClassName}>URL chuẩn<input className={inputClassName} onChange={(event) => update("canonicalUrl", event.target.value)} type="url" value={form.canonicalUrl} /></label>
        <label className={labelClassName}>Nhãn hiển thị<input className={inputClassName} onChange={(event) => update("badgeText", event.target.value)} value={form.badgeText} /></label>
        <label className={labelClassName}>Nhãn CTA<input className={inputClassName} onChange={(event) => update("ctaLabel", event.target.value)} value={form.ctaLabel} /></label>
        <label className={labelClassName}>URL CTA<input className={inputClassName} onChange={(event) => update("ctaUrl", event.target.value)} type="url" value={form.ctaUrl} /></label>
        {form.type === "promotion" ? <><label className={labelClassName}>Bắt đầu khuyến mãi<input className={inputClassName} onChange={(event) => update("promotionStartAt", event.target.value)} type="datetime-local" value={form.promotionStartAt} /></label><label className={labelClassName}>Kết thúc khuyến mãi<input className={inputClassName} onChange={(event) => update("promotionEndAt", event.target.value)} type="datetime-local" value={form.promotionEndAt} /></label></> : null}
      </div></EditorSection></div> : null}

      {activeTab === "history" && post ? <EditorSection description="Xem lại hoặc khôi phục một phiên bản đã được lưu trước đó." title="Lịch sử phiên bản"><RevisionHistory target="posts" id={post.id} expectedVersion={savedVersion} disabled={isDirty || processing} onRestorePendingChange={restore.onPendingChange} onRestored={restore.onRestored} /></EditorSection> : null}

      <AdminEditorActions>{isDirty ? <p className="admin-help admin-text-warning" role="status">Có thay đổi chưa lưu.</p> : null}<AdminButton disabled={isSaving} permission={post ? "posts.update" : "posts.create"} type="submit">{isSaving ? "Đang lưu..." : post ? "Lưu thay đổi" : "Tạo bài viết"}</AdminButton></AdminEditorActions>
      </fieldset>
    </form>
  );
}
