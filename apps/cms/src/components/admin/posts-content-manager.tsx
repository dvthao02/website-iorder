"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MediaPicker } from "./media-picker";
import { RevisionHistory } from "./revision-history";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { AdminEditorTabs } from "./ui/admin-editor-tabs";
import { AdminButton } from "./ui/admin-button";
import { AdminNotice } from "./ui/admin-feedback";

import type { AdminPost, PostContentDocument } from "@iorder/core/server/posts/posts.contract";

type Notice = { kind: "error" | "success"; message: string } | undefined;

const inputClassName = "admin-input";
const labelClassName = "grid gap-2 text-sm font-bold text-[var(--cms-text)]";
type PostBlock = PostContentDocument["blocks"][number];

function EditorSection({ children, description, title }: { children: ReactNode; description?: string; title: string }) {
  return <section className="admin-content-section grid gap-4 rounded-xl border p-4 sm:p-5"><header><h3 className="text-base font-extrabold text-[var(--cms-text)]">{title}</h3>{description ? <p className="mt-1 text-sm leading-6 text-[var(--cms-muted)]">{description}</p> : null}</header>{children}</section>;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function dateTimeInputValue(value: Date | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
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
    {blocks.map((block, index) => <article className="admin-post-document-editor__block grid gap-4 rounded-xl border p-4" key={index}>
      <div className="flex flex-wrap items-center justify-between gap-3"><strong className="text-sm text-[var(--cms-text)]">Khối {index + 1}: {block.type === "paragraph" ? "Đoạn văn" : "Danh sách kiểm tra"}</strong><div className="admin-post-document-editor__actions"><button type="button" disabled={index === 0} onClick={() => onChange({ ...document, blocks: movePostBlock(blocks, index, -1) })}>Lên</button><button type="button" disabled={index === blocks.length - 1} onClick={() => onChange({ ...document, blocks: movePostBlock(blocks, index, 1) })}>Xuống</button><button type="button" className="admin-post-document-editor__danger" onClick={() => onChange({ ...document, blocks: blocks.filter((_, blockIndex) => blockIndex !== index) })}>Xóa</button></div></div>
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
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload
      ? (payload as { error?: { message?: unknown } }).error?.message
      : undefined;
    throw new Error(typeof message === "string" ? message : "Không thể lưu bài viết. Vui lòng thử lại.");
  }

  return payload as { post: AdminPost };
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
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-extrabold tracking-tight text-slate-900">Bài viết</h2>
          <button className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800" onClick={() => { setIsCreating(true); setActivePostId(undefined); }} type="button">Thêm mới</button>
        </div>
        <div className="grid gap-2">
          {posts.map((post) => (
            <button className={`rounded-xl px-3 py-3 text-left text-sm transition ${post.id === activePostId && !isCreating ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50"}`} key={post.id} onClick={() => { setActivePostId(post.id); setIsCreating(false); }} type="button">
              <span className="block font-bold">{post.title}</span>
              <span className="mt-1 block text-xs text-slate-500">{post.type} · {post.status} · v{post.draftVersion}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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
        ) : <p className="text-slate-600">Chưa có bài viết nào. Chọn “Thêm mới” để bắt đầu.</p>}
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
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const { isDirty, markSaved } = useUnsavedChanges(form);
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  function update<Field extends keyof typeof form>(field: Field, value: (typeof form)[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const payload = formToPayload(form);
      const result = await requestJson(post ? `/api/admin/posts/${post.id}` : "/api/admin/posts", post ? "PATCH" : "POST", payload);
      markSaved();
      onSaved(result.post, !post);
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : "Không thể lưu bài viết.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <AdminEditorTabs activeId={activeTab} onChange={setActiveTab} tabs={[{ id: "basic", label: "Thông tin" }, { id: "content", label: "Nội dung" }, { id: "publishing", label: "Xuất bản & SEO" }, ...(post ? [{ id: "history", label: "Lịch sử" }] : [])]} />

      {activeTab === "basic" ? <div className="grid gap-5">
      <EditorSection description="Thông tin nhận diện và đường dẫn dùng cho bài viết." title="Thông tin cơ bản"><div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>Loại bài viết<select className={inputClassName} disabled={Boolean(contentType)} onChange={(event) => update("type", event.target.value as typeof form.type)} value={form.type}><option value="news">Tin tức</option><option value="promotion">Khuyến mãi</option><option value="case_study">Câu chuyện khách hàng</option><option value="announcement">Thông báo</option>{contentType === "guide" ? <option value="guide">Hướng dẫn</option> : null}</select></label>
        <label className={labelClassName}>Tiêu đề<input className={inputClassName} onChange={(event) => update("title", event.target.value)} required value={form.title} /></label>
        <label className={labelClassName}>Slug<input className={inputClassName} onChange={(event) => update("slug", event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={form.slug} /></label>
      </div></EditorSection>

      <EditorSection description="Ảnh đại diện hiển thị trong danh sách tin và trang chi tiết." title="Media"><MediaPicker value={form.coverMediaId} onChange={value => update("coverMediaId", value)} /></EditorSection>
      <EditorSection description="Chọn các nhóm giúp người đọc tìm bài viết trong trang tin." title="Phân loại"><div className="grid gap-5 sm:grid-cols-2"><fieldset className="grid gap-3"><legend className="text-sm font-bold text-[var(--cms-text)]">Chuyên mục</legend>{taxonomy.categories.length ? taxonomy.categories.map(category => <label className="admin-post-editor__check" key={category.id}><input type="checkbox" checked={form.categoryIds.includes(category.id)} onChange={event => update("categoryIds", event.target.checked ? [...form.categoryIds, category.id] : form.categoryIds.filter(id => id !== category.id))} />{category.name}</label>) : <p className="text-sm text-[var(--cms-muted)]">Chưa có chuyên mục. Tạo tại mục “Chuyên mục và thẻ”.</p>}</fieldset><fieldset className="grid gap-3"><legend className="text-sm font-bold text-[var(--cms-text)]">Thẻ</legend>{taxonomy.tags.length ? taxonomy.tags.map(tag => <label className="admin-post-editor__check" key={tag.id}><input type="checkbox" checked={form.tagIds.includes(tag.id)} onChange={event => update("tagIds", event.target.checked ? [...form.tagIds, tag.id] : form.tagIds.filter(id => id !== tag.id))} />{tag.name}</label>) : <p className="text-sm text-[var(--cms-muted)]">Chưa có thẻ. Tạo tại mục “Chuyên mục và thẻ”.</p>}</fieldset></div></EditorSection>
      </div> : null}

      {activeTab === "content" ? <div className="grid gap-5"><EditorSection description="Phần tóm tắt hiển thị ở danh sách tin và khi chia sẻ liên kết." title="Tóm tắt"><label className={labelClassName}>Tóm tắt<textarea className={inputClassName} onChange={(event) => update("excerpt", event.target.value)} rows={4} value={form.excerpt} /></label></EditorSection><EditorSection description="Sắp xếp các khối theo đúng thứ tự muốn xuất hiện trên website." title="Nội dung bài viết"><PostDocumentEditor document={form.content} onChange={content => update("content", content)} /></EditorSection></div> : null}

      {activeTab === "publishing" ? <div className="grid gap-5"><EditorSection title="Xuất bản"><div className="grid gap-4 sm:grid-cols-2"><label className={labelClassName}>Trạng thái<select className={inputClassName} onChange={(event) => update("status", event.target.value as typeof form.status)} value={form.status}><option value="draft">Bản nháp</option><option value="review">Chờ duyệt</option><option value="scheduled">Hẹn giờ</option><option value="published">Xuất bản</option><option value="archived">Lưu trữ</option></select></label>{form.status === "scheduled" ? <label className={labelClassName}>Thời điểm hẹn giờ<input className={inputClassName} onChange={(event) => update("scheduledAt", event.target.value)} type="datetime-local" value={form.scheduledAt} /></label> : null}</div></EditorSection><EditorSection description="Thông tin dành cho công cụ tìm kiếm, liên kết chia sẻ và lời kêu gọi hành động." title="SEO & hiển thị"><div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>Tiêu đề SEO<input className={inputClassName} onChange={(event) => update("seoTitle", event.target.value)} value={form.seoTitle} /></label>
        <label className={labelClassName}>Mô tả SEO<input className={inputClassName} onChange={(event) => update("seoDescription", event.target.value)} value={form.seoDescription} /></label>
        <label className={labelClassName}>URL chuẩn<input className={inputClassName} onChange={(event) => update("canonicalUrl", event.target.value)} type="url" value={form.canonicalUrl} /></label>
        <label className={labelClassName}>Nhãn hiển thị<input className={inputClassName} onChange={(event) => update("badgeText", event.target.value)} value={form.badgeText} /></label>
        <label className={labelClassName}>Nhãn CTA<input className={inputClassName} onChange={(event) => update("ctaLabel", event.target.value)} value={form.ctaLabel} /></label>
        <label className={labelClassName}>URL CTA<input className={inputClassName} onChange={(event) => update("ctaUrl", event.target.value)} type="url" value={form.ctaUrl} /></label>
        {form.type === "promotion" ? <><label className={labelClassName}>Bắt đầu khuyến mãi<input className={inputClassName} onChange={(event) => update("promotionStartAt", event.target.value)} type="datetime-local" value={form.promotionStartAt} /></label><label className={labelClassName}>Kết thúc khuyến mãi<input className={inputClassName} onChange={(event) => update("promotionEndAt", event.target.value)} type="datetime-local" value={form.promotionEndAt} /></label></> : null}
      </div></EditorSection></div> : null}

      {activeTab === "history" && post ? <EditorSection description="Xem lại hoặc khôi phục một phiên bản đã được lưu trước đó." title="Lịch sử phiên bản"><RevisionHistory target="posts" id={post.id} /></EditorSection> : null}

      <AdminEditorActions>{isDirty ? <p className="mb-0 text-sm text-amber-700" role="status">Có thay đổi chưa lưu.</p> : null}<AdminButton disabled={isSaving} type="submit">{isSaving ? "Đang lưu..." : post ? "Lưu thay đổi" : "Tạo bài viết"}</AdminButton></AdminEditorActions>
    </form>
  );
}
