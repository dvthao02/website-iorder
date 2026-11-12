"use client";
import { ContentSeoEditor } from "./content-seo-editor";
import { staticPageHints, staticPageProfile } from "@iorder/shared/server/pages/static-page-layout";
import { CmsPageBuilder } from "./cms-page-builder";
import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { formatLocalDateTime } from "@/lib/local-date-time";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { pageValidationMessage } from "@iorder/shared/server/pages/page-validation";
import { getFixedWebsitePage, pageInputSchema, isListingPageSlug, pagePermissionCodes, type AdminPage, type PageBlock } from "@iorder/shared/server/pages/pages.contract";
import { listingChildPages, listingPageModuleHref } from "@/lib/listing-pages";

import { withoutEmptyGroupedListItems, withoutEmptyHeroSlides } from "./page-blocks-editor";
import { PublishedPreviewLink } from "./published-preview-link";
import { RevisionHistory } from "./revision-history";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminEditorSection } from "./ui/admin-editor-section";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { AdminDetailPanel } from "./ui/admin-detail-panel";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminButton } from "./ui/admin-button";
import { useAdminPermissions } from "./ui/admin-permissions";
import { createTransientDraftStore } from "./ui/transient-draft-store";
import { ContentStatusChoice, contentStatusBadge, contentSubmitLabel } from "./ui/content-status-choice";
import { SeoAssistant } from "./ui/seo-assistant";
import { seoChecks } from "@iorder/shared/server/shared/seo";
import { toSlug } from "@/lib/slug";

function toForm(page: AdminPage | undefined) { return { title: page?.title ?? "", slug: page?.slug ?? "", template: page?.template ?? "default", status: page?.status ?? "draft", seoTitle: page?.seoTitle ?? "", seoDescription: page?.seoDescription ?? "", canonicalUrl: page?.canonicalUrl ?? "", seo: page?.seo ?? {}, scheduledAt: formatLocalDateTime(page?.scheduledAt), blocks: page?.blocks ?? [] }; }
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
  const [saveError, setSaveError] = useState("");
  // Thành phần đang mở: giữ ở đây để thẻ "Bố cục trang" (cột phải) mở và nhảy tới đúng thành phần.
  const [openBlock, setOpenBlock] = useState<number | null>(() => (form.blocks as PageBlock[]).length ? 0 : null);
  const { isDirty, markSaved, getSavedValue } = useUnsavedChanges(form, serverForm);
  useEffect(() => {
    if (isDirty) pageDrafts.write(draftKey, serverBaseline, form);
    else pageDrafts.remove(draftKey);
  }, [draftKey, serverBaseline, form, isDirty]);
  const { show: showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();
  useNavigationGuard(processing, () => showToast("Đang xử lý trang. Vui lòng chờ trước khi rời màn hình.", "info"));
  const fixedPage = page ? getFixedWebsitePage(page.slug) : undefined;
  const listingSlug = page && isListingPageSlug(page.slug) ? page.slug : undefined;
  const canComposePage = !fixedPage && !listingSlug;
  const pageType = listingSlug ? "Trang danh sách tự động" : fixedPage ? "Trang có sẵn" : "Trang tự tạo";
  const publicPath = fixedPage?.publicPath ?? `/trang/${form.slug || "duong-dan"}`;
  const { can, canAny } = useAdminPermissions();
  // Trang danh sách thuộc module của nó; Trang chủ mở từ sidebar; trang khác nằm trong "Trang website".
  const backHref = listingSlug ? listingPageModuleHref[listingSlug] : page?.slug === "home" ? "/admin" : "/admin/pages";
  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => { if (canEdit) setForm(current => ({ ...current, [key]: value })); };
  const canPublish = canAny(pagePermissionCodes(page?.slug, "publish"));
  const canEdit = (page ? canAny(pagePermissionCodes(page.slug, "update")) : can("pages.create")) && (canPublish || !["published", "scheduled"].includes(page?.status ?? "draft"));
  const [editingSlug, setEditingSlug] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Trang mới: slug tự theo tiêu đề cho tới khi người dùng tự sửa. Trang đã có giữ slug (đổi slug làm hỏng liên kết).
  const [slugTouched, setSlugTouched] = useState(Boolean(page));
  const changeTitle = (title: string) => { if (canEdit) setForm(current => ({ ...current, title, ...(slugTouched || fixedPage ? {} : { slug: toSlug(title, 80) }) })); };
  // Website chỉ dùng mô tả SEO đã nhập cho Trang (không tự lấy đoạn văn), nên chỉ kiểm tra tiêu đề, mô tả và đường dẫn.
  const seoCheckIds = fixedPage ? ["title", "description"] : ["title", "description", "slug"];
  const seoResults = seoChecks({ title: form.title, seoTitle: form.seoTitle, seoDescription: form.seoDescription, excerpt: "", slug: form.slug, hasCover: false }).filter(check => seoCheckIds.includes(check.id));
  const seoPassed = seoResults.filter(check => check.ok).length;
  // Giữ trạng thái thì nút là "Lưu thay đổi"; đổi trạng thái thì nút nói rõ hành động (Xuất bản, Gửi duyệt…).
  const submitText = page && form.status === page.status ? "Lưu thay đổi" : contentSubmitLabel(form.status, page?.status, "trang");
  const formRef = useRef<HTMLFormElement>(null);
  // Ctrl+S / ⌘+S lưu ngay, không phải cuộn xuống thanh lưu.
  useEffect(() => {
    function save(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); formRef.current?.requestSubmit(); }
    }
    window.addEventListener("keydown", save);
    return () => window.removeEventListener("keydown", save);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || saving.current || uploading.current || restoring.current || !isDirty) return;
    // Gỡ trang hệ thống khỏi website làm URL cố định của nó trả 404 (trang chủ thì mất hẳn nội dung): hỏi lại trước khi lưu.
    const leavesWebsite = (status: string) => status !== "published" && status !== "scheduled";
    if (fixedPage && page && !leavesWebsite(page.status) && leavesWebsite(form.status)) {
      saving.current = true;
      const accepted = await confirm({
        title: page.slug === "home" ? "Gỡ trang chủ khỏi website?" : `Gỡ trang “${page.title}” khỏi website?`,
        message: page.slug === "home" ? "Khách vào website sẽ không còn thấy nội dung trang chủ cho tới khi bạn xuất bản lại." : `Đường dẫn ${fixedPage.publicPath} sẽ trả về lỗi 404 cho tới khi bạn xuất bản lại.`,
        confirmLabel: "Vẫn gỡ khỏi website", cancelLabel: "Giữ trên website", tone: "danger",
      });
      saving.current = false;
      if (!accepted) return;
    }
    saving.current = true;
    setBusy(true); setMessage(""); setSaveError("");
    try {
      const values = { ...form, blocks: withoutEmptyGroupedListItems(withoutEmptyHeroSlides(form.blocks as PageBlock[])), seoTitle: form.seoTitle || null, seoDescription: form.seoDescription || null, canonicalUrl: form.canonicalUrl || null, scheduledAt: form.scheduledAt || null };
      const validated = pageInputSchema.safeParse(values);
      if (!validated.success) {
        const blockIssue = validated.error.issues.find(issue => issue.path[0] === "blocks" && typeof issue.path[1] === "number");
        if (blockIssue) setOpenBlock(blockIssue.path[1] as number);
        throw new Error(pageValidationMessage(validated.error.issues));
      }
      const response = await fetch("/api/v1/admin/pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: page?.id ?? null, expectedVersion: savedVersion, values: validated.data }) });
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
    } catch (error) { const notice = error instanceof Error ? error.message : "Không thể lưu trang lúc này."; setSaveError(notice); showToast(notice, "error"); }
    finally { saving.current = false; setBusy(false); }
  }

  return <AdminDetailPanel backHref={backHref} description={`Địa chỉ trên website: ${publicPath}`} eyebrow={page?.slug === "home" ? "Trang chủ" : "Trang website"} hasUnsavedChanges={isDirty} notice={saveError ? <AdminNotice tone="error">{saveError}</AdminNotice> : undefined} title={page?.title ?? "Tạo trang mới"}>
    <form id="page-editor" className="admin-post-editor admin-page-editor" onSubmit={submit} ref={formRef}>
      {!canEdit ? <div className="col-span-full"><AdminNotice tone="info">Bạn chỉ có quyền xem nội dung này. Nội dung đang hiển thị cần thêm quyền xuất bản để sửa.</AdminNotice></div> : null}
      <fieldset className="contents" disabled={processing}>
      <div className="admin-post-editor__main">
        {/* Trang hệ thống: tên và đường dẫn cố định, header đã hiển thị nên không lặp lại card này. */}
        {fixedPage ? null : <section className="admin-content-section admin-post-editor__writing">
          <label className="admin-post-editor__title-field"><span className="sr-only">Tên trang</span><input className="admin-post-editor__title" maxLength={220} onChange={event => changeTitle(event.target.value)} placeholder="Nhập tên trang…" required value={form.title} /></label>
          {editingSlug ? <div className="admin-post-editor__slug-edit">
            <div className="admin-field"><label className="admin-seo__label" htmlFor="page-slug">Đường dẫn<span className="admin-help">Phần địa chỉ không dấu, ví dụ: {publicPath}</span></label><span className="admin-post-editor__slug"><input autoFocus className="admin-input" id="page-slug" onChange={event => { setSlugTouched(true); set("slug", event.target.value); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="gioi-thieu-san-pham" required value={form.slug} /><AdminButton disabled={!form.title.trim() || toSlug(form.title, 80) === form.slug} onClick={() => { setSlugTouched(true); set("slug", toSlug(form.title, 80)); }} size="sm" variant="secondary">Tạo từ tên</AdminButton><AdminButton onClick={() => setEditingSlug(false)} size="sm" variant="ghost">Xong</AdminButton></span></div>
            {page?.status === "published" && form.status === "published" ? <small className="admin-help">Trang đang hiển thị: khi lưu với đường dẫn mới, đường dẫn cũ tự chuyển hướng (301) sang đường dẫn mới.</small> : page?.status === "published" ? <small className="admin-help admin-text-warning">Sau lần lưu này nội dung chưa hiện ngay trên website nên đổi đường dẫn sẽ không tạo chuyển hướng từ đường dẫn cũ.</small> : <small className="admin-help">Chỉ dùng chữ thường không dấu, số và dấu gạch ngang.</small>}
          </div> : <p className="admin-post-editor__slug-line"><span className="admin-help">Đường dẫn:</span> <span className="admin-post-editor__path">{publicPath}</span><button className="admin-post-editor__link" onClick={() => setEditingSlug(true)} type="button">Sửa</button>{!slugTouched ? <span className="admin-help"> · tự tạo theo tên</span> : null}</p>}
        </section>}
        <EditorCard title={canComposePage ? "Nhóm thành phần và bố cục" : "Nội dung và bố cục"} description={listingSlug ? "Phần đầu trang luôn ở trên cùng. Danh sách bài viết, sản phẩm hoặc thiết bị được cập nhật tự động từ mục quản lý tương ứng." : canComposePage ? "Chọn nhóm thành phần để xây trang theo từng phần, rồi kéo thả để sắp xếp thứ tự hiển thị." : staticPageHints[staticPageProfile(page?.slug ?? "", form.template)]}><CmsPageBuilder readOnly={!canEdit} documentId={page?.id ?? null} document={{ kind: "page", values: { ...form, blocks: withoutEmptyGroupedListItems(withoutEmptyHeroSlides(form.blocks as PageBlock[])), seoTitle: form.seoTitle || null, seoDescription: form.seoDescription || null, canonicalUrl: form.canonicalUrl || null, scheduledAt: form.scheduledAt || null } }} blocks={form.blocks as PageBlock[]} disabled={processing} listing={Boolean(listingSlug)} onChange={blocks => set("blocks", blocks)} onOpenIndexChange={setOpenBlock} onUploadingChange={handleUploadingChange} openIndex={openBlock} showGroupPicker={canComposePage} /></EditorCard>
        {listingSlug && listingChildPages[listingSlug].length ? <EditorCard title="Trang con" description="Các trang chi tiết không sửa ở đây: mỗi trang lấy nội dung từ mục quản lý tương ứng."><div className="admin-check-list">{listingChildPages[listingSlug].map((child) => <Link href={child.href} key={child.path}><span aria-hidden="true" /><span><strong>{child.label} <code>{child.path}</code></strong><small>{child.source}</small></span><span className="admin-link">Mở</span></Link>)}</div></EditorCard> : null}
        <details className="admin-post-editor__panel">
          <summary><span><strong>Google &amp; chia sẻ mạng xã hội</strong><small>Tiêu đề và mô tả khi trang hiện trên Google, Facebook, Zalo.</small></span><AdminStatusBadge tone={seoPassed === seoResults.length ? "success" : "warning"}>SEO {seoPassed}/{seoResults.length} đạt</AdminStatusBadge></summary>
          <div className="admin-post-editor__panel-body">
            <SeoAssistant checkIds={seoCheckIds} excerpt="" hasCover={false} onChange={(field, value) => set(field, value)} path={publicPath} seoDescription={form.seoDescription} seoTitle={form.seoTitle} slug={form.slug} title={form.title} />
            <ContentSeoEditor value={form.seo} onChange={seo => set("seo", seo)} title={form.seoTitle || form.title} description={form.seoDescription || ""} disabled={processing || !canEdit} onUploadingChange={handleUploadingChange} />
            <label className="admin-field">Địa chỉ chính thức của nội dung (nâng cao)<input className="admin-input" onChange={event => set("canonicalUrl", event.target.value)} placeholder="Chỉ điền khi nội dung này được sao chép từ một địa chỉ khác" type="url" value={form.canonicalUrl} /></label>
          </div>
        </details>
        {page && can("pages.view") ? <details className="admin-post-editor__panel" onToggle={event => setHistoryOpen(event.currentTarget.open)}>
          <summary><span><strong>Lịch sử phiên bản</strong><small>Xem lại hoặc khôi phục bản đã lưu</small></span></summary>
          {historyOpen ? <div className="admin-post-editor__panel-body"><RevisionHistory target="pages" id={page.id} expectedVersion={savedVersion} disabled={processing || isDirty} onRestorePendingChange={handleRestorePendingChange} onRestored={() => router.refresh()} /></div> : null}
        </details> : null}
      </div>

      <details className="admin-post-editor__panel admin-page-editor__settings"><summary><strong>Xuất bản và thông tin trang</strong></summary><div className="admin-post-editor__panel-body">
        <section className="admin-content-section">
          <header className="admin-post-editor__card-head"><h3>Xuất bản</h3>{page ? <PublishedPreviewLink id={page.id} kind="page" slug={page.slug} status={page.status} /> : null}</header>
          {page && isDirty ? <p className="admin-help">Xem trước hiển thị bản đã lưu — lưu trước để thấy thay đổi mới.</p> : null}
          {page ? <p className="admin-post-editor__state"><AdminStatusBadge tone={contentStatusBadge[page.status].tone}>{contentStatusBadge[page.status].label}</AdminStatusBadge></p> : <p className="admin-help">Trang mới — chưa lưu.</p>}
          <ContentStatusChoice canPublish={canPublish} noun="trang" onChange={status => set("status", status)} savedStatus={page?.status} value={form.status} />
          {form.status === "scheduled" ? <label className="admin-field">Thời điểm đăng<input className="admin-input" onChange={event => set("scheduledAt", event.target.value)} required type="datetime-local" value={form.scheduledAt} /></label> : null}
        </section>
        <section className="admin-content-section">
          <header><h3>Loại trang</h3></header>
          <p><AdminStatusBadge tone="neutral">{pageType}</AdminStatusBadge></p>
          <p className="admin-help">{listingSlug ? "Danh sách trên trang được cập nhật tự động. Bạn chỉ cần sửa phần giới thiệu, bố cục và thông tin Google." : fixedPage ? "Trang có sẵn của website; địa chỉ không thể thay đổi." : "Trang do bạn tạo. Sau khi xuất bản, hãy thêm trang vào Menu để khách truy cập."}</p>
        </section>
      </div></details>
      </fieldset>
      <AdminEditorActions><p className={isDirty ? "admin-text-warning" : undefined} role="status">{isUploading ? "Đang tải ảnh nội dung…" : busy ? "Đang lưu trang…" : isDirty ? "Có thay đổi chưa lưu." : message || "Không có thay đổi chưa lưu."}</p>{isDirty ? <AdminButton disabled={processing} variant="secondary" onClick={() => {
        if (saving.current || uploading.current || restoring.current) return;
        setForm(getSavedValue());
        setMessage("");
        setSaveError("");
      }}>Bỏ thay đổi</AdminButton> : null}<AdminButton disabled={processing || !isDirty || !canEdit} permission={page ? pagePermissionCodes(page.slug, "update") : "pages.create"} title="Phím tắt: Ctrl+S" type="submit">{busy ? "Đang lưu…" : submitText}</AdminButton></AdminEditorActions>
    </form>
  </AdminDetailPanel>;
}

function EditorCard({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <AdminEditorSection description={description} title={title}>{children}</AdminEditorSection>; }
