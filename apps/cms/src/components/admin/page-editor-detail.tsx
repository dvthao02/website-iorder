"use client";
import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { PublishPermissionHint, PublishStatusOptions } from "./ui/publish-status-options";
import { formatLocalDateTime } from "@/lib/local-date-time";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { getFixedWebsitePage, isListingPageSlug, pagePermissionCodes, type AdminPage, type PageBlock } from "@iorder/core/server/pages/pages.contract";
import { listingChildPages, listingPageModuleHref } from "@/lib/listing-pages";

import { PageBlocksEditor } from "./page-blocks-editor";
import { PublishedPreviewLink } from "./published-preview-link";
import { RevisionHistory } from "./revision-history";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { AdminDetailPanel } from "./ui/admin-detail-panel";
import { AdminEditorTabs } from "./ui/admin-editor-tabs";
import { useAdminToast } from "./ui/admin-feedback";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { AdminButton } from "./ui/admin-button";
import { useAdminPermissions } from "./ui/admin-permissions";
import { createTransientDraftStore } from "./ui/transient-draft-store";

function toForm(page: AdminPage | undefined) { return { title: page?.title ?? "", slug: page?.slug ?? "", template: page?.template ?? "default", status: page?.status ?? "draft", seoTitle: page?.seoTitle ?? "", seoDescription: page?.seoDescription ?? "", canonicalUrl: page?.canonicalUrl ?? "", scheduledAt: formatLocalDateTime(page?.scheduledAt), blocks: page?.blocks ?? [] }; }
const pageDrafts = createTransientDraftStore<ReturnType<typeof toForm>>();

export function PageEditorDetail({ page }: { page?: AdminPage }) {
  const router = useRouter();
  const draftKey = `${router.bfcacheId}:${page?.id ?? "new"}`;
  const serverForm = toForm(page);
  const serverBaseline = JSON.stringify(serverForm);
  const [form, setForm] = useState(() => pageDrafts.read(draftKey, serverBaseline) ?? serverForm);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const restoring = useRef(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const handleRestorePendingChange = useCallback((pending: boolean) => {
    restoring.current = pending;
    setIsRestoring(pending);
  }, []);
  const [savedVersion, setSavedVersion] = useState(page?.draftVersion);
  const uploading = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const handleUploadingChange = useCallback((pending: boolean) => {
    uploading.current = pending;
    setIsUploading(pending);
  }, []);
  const processing = busy || isUploading || isRestoring;
  const [message, setMessage] = useState("");
  const { isDirty, markSaved, getSavedValue } = useUnsavedChanges(form, serverForm);
  useEffect(() => {
    if (isDirty) pageDrafts.write(draftKey, serverBaseline, form);
    else pageDrafts.remove(draftKey);
  }, [draftKey, serverBaseline, form, isDirty]);
  const { show: showToast } = useAdminToast();
  useNavigationGuard(processing, () => showToast("Đang xử lý trang. Vui lòng chờ trước khi rời màn hình.", "info"));
  const fixedPage = page ? getFixedWebsitePage(page.slug) : undefined;
  const listingSlug = page && isListingPageSlug(page.slug) ? page.slug : undefined;
  const pageType = listingSlug ? "Trang danh sách" : fixedPage ? "Trang hệ thống" : "Trang tự tạo";
  const publicPath = fixedPage?.publicPath ?? (form.slug ? `/trang/${form.slug}` : "Sẽ tạo sau khi nhập slug");
  const { can, canAny } = useAdminPermissions();
  const backHref = listingSlug && !can("pages.view") ? listingPageModuleHref[listingSlug] : "/admin/pages";
  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => setForm(current => ({ ...current, [key]: value }));
  const [activeTab, setActiveTab] = useState("content");
  const tabs = [{ id: "content", label: "Nội dung" }, { id: "settings", label: "Thiết lập & SEO" }, ...(page && can("pages.view") ? [{ id: "history", label: "Lịch sử" }] : [])];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || uploading.current || restoring.current || !isDirty) return;
    saving.current = true;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: page?.id ?? null, expectedVersion: savedVersion, values: { ...form, seoTitle: form.seoTitle || null, seoDescription: form.seoDescription || null, canonicalUrl: form.canonicalUrl || null, scheduledAt: form.scheduledAt || null } }) });
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không thể lưu trang.");
      const savedId = payload.page?.id;
      if (typeof savedId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(savedId) || (page && savedId !== page.id)) {
        throw new Error("Phản hồi lưu trang không hợp lệ. Kiểm tra danh sách trước khi thử lại.");
      }
      const nextVersion = payload.page?.draftVersion;
      if (!Number.isSafeInteger(nextVersion) || nextVersion !== (savedVersion ?? 0) + 1) throw new Error("Phiên bản phản hồi lưu trang không hợp lệ. Kiểm tra danh sách trước khi thử lại.");
      setSavedVersion(nextVersion);
      markSaved();
      setMessage("Đã lưu thay đổi và tạo phiên bản mới.");
      showToast("Đã lưu thay đổi và tạo phiên bản mới.", "success");
      if (!page) router.replace(`/admin/pages/${savedId}`);
      router.refresh();
    } catch (error) { const notice = error instanceof Error ? error.message : "Không thể lưu trang lúc này."; setMessage(notice); showToast(notice, "error"); }
    finally { saving.current = false; setBusy(false); }
  }

  return <AdminDetailPanel actions={<PublishedPreviewLink id={page?.id} kind="page" slug={page?.slug} status={page?.status} />} backHref={backHref} description={`Đường dẫn hiển thị: ${publicPath}`} eyebrow={pageType} hasUnsavedChanges={isDirty} title={page?.title ?? "Tạo trang mới"}>
    <form id="page-editor" className="grid gap-4" onSubmit={submit}>
      <AdminEditorTabs activeId={activeTab} onChange={setActiveTab} tabs={tabs} />
      <fieldset className="grid min-w-0 gap-3" disabled={processing}>
      {activeTab === "content" ? <>
      <EditorCard title="Thành phần trang" description={listingSlug ? "Phần đầu trang luôn ở trên cùng. Các thành phần còn lại hiển thị theo thứ tự; “Danh sách nội dung” là nơi hiện bài viết, sản phẩm… Nếu trang không có danh sách nào, website tự thêm danh sách mặc định ở cuối." : "Bấm vào một thành phần để sửa; dùng mũi tên để đổi thứ tự, biểu tượng mắt để ẩn/hiện."}><PageBlocksEditor blocks={form.blocks as PageBlock[]} disabled={processing} listing={Boolean(listingSlug)} onUploadingChange={handleUploadingChange} onChange={blocks => set("blocks", blocks)} /></EditorCard>
      {listingSlug ? <EditorCard title="Trang con" description="Các trang chi tiết không sửa ở đây: mỗi trang lấy nội dung từ mục quản lý tương ứng."><div className="admin-check-list">{listingChildPages[listingSlug].map((child) => <Link href={child.href} key={child.path}><span aria-hidden="true" /><span><strong>{child.label} <code>{child.path}</code></strong><small>{child.source}</small></span><span className="admin-link">Mở</span></Link>)}</div></EditorCard> : null}
      </> : null}
      {activeTab === "settings" ? <>
      <EditorCard title="Xuất bản" description="Chọn thời điểm trang xuất hiện hoặc ngừng hiển thị trên website."><div className="admin-form-grid"><label className="admin-field">Trạng thái<select value={form.status} onChange={event => set("status", event.target.value as typeof form.status)}><PublishStatusOptions canPublish={canAny(pagePermissionCodes(page?.slug, "publish"))} current={form.status} /></select></label><PublishPermissionHint canPublish={canAny(pagePermissionCodes(page?.slug, "publish"))} /><label className="admin-field">Thời điểm xuất bản<input type="datetime-local" value={form.scheduledAt} onChange={event => set("scheduledAt", event.target.value)} disabled={form.status !== "scheduled"} /></label></div></EditorCard>
      <EditorCard title="Thuộc tính trang" description="Thông tin nhận diện và đường dẫn của trang."><div className="admin-form-grid"><label className="admin-field md:col-span-2">Tiêu đề trang<input required value={form.title} onChange={event => set("title", event.target.value)} /></label><div className="admin-field"><span>Loại trang</span><span className="admin-readonly">{pageType}</span></div>{fixedPage ? <div className="admin-field"><span>Đường dẫn</span><span className="admin-readonly">{fixedPage.publicPath}</span></div> : <label className="admin-field">Slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={event => set("slug", event.target.value)} placeholder="gioi-thieu-san-pham" /></label>}</div></EditorCard>
      <EditorCard title="SEO" description="Thông tin hỗ trợ công cụ tìm kiếm và nội dung khi chia sẻ liên kết."><div className="grid gap-4"><label className="admin-field">Tiêu đề SEO<input maxLength={70} value={form.seoTitle} onChange={event => set("seoTitle", event.target.value)} /></label><label className="admin-field">Mô tả SEO<textarea className="min-h-28" maxLength={180} value={form.seoDescription} onChange={event => set("seoDescription", event.target.value)} /></label><label className="admin-field">URL chuẩn<input type="url" value={form.canonicalUrl} onChange={event => set("canonicalUrl", event.target.value)} placeholder="https://…" /></label></div></EditorCard>
      </> : null}
      {activeTab === "history" && page && can("pages.view") ? <EditorCard title="Lịch sử phiên bản" description="Có thể xem và khôi phục phiên bản đã lưu trước đó."><RevisionHistory target="pages" id={page.id} expectedVersion={savedVersion} disabled={processing || isDirty} onRestorePendingChange={handleRestorePendingChange} onRestored={() => router.refresh()} /></EditorCard> : null}
      </fieldset>
      <AdminEditorActions><p className={isDirty ? "admin-text-warning" : undefined} role="status">{isUploading ? "Đang tải ảnh nội dung…" : busy ? "Đang lưu trang…" : isDirty ? "Có thay đổi chưa lưu." : message || "Không có thay đổi chưa lưu."}</p>{isDirty ? <AdminButton disabled={processing} variant="secondary" onClick={() => {
        if (saving.current || uploading.current || restoring.current) return;
        setForm(getSavedValue());
        setMessage("");
      }}>Bỏ thay đổi</AdminButton> : null}<AdminButton disabled={processing || !isDirty} permission={page ? pagePermissionCodes(page.slug, "update") : "pages.create"} type="submit">{busy ? "Đang lưu…" : "Lưu thay đổi"}</AdminButton></AdminEditorActions>
    </form>
  </AdminDetailPanel>;
}

function EditorCard({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="admin-content-section"><header><h2>{title}</h2><p>{description}</p></header>{children}</section>; }
