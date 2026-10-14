"use client";
import { formatLocalDateTime } from "@/lib/local-date-time";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { getFixedWebsitePage, type AdminPage, type PageBlock } from "@iorder/core/server/pages/pages.contract";

import { PageBlocksEditor } from "./page-blocks-editor";
import { PublishedPreviewLink } from "./published-preview-link";
import { RevisionHistory } from "./revision-history";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { AdminDetailPanel } from "./ui/admin-detail-panel";
import { useAdminToast } from "./ui/admin-feedback";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { AdminButton } from "./ui/admin-button";
import { createTransientDraftStore } from "./ui/transient-draft-store";

function toForm(page: AdminPage | undefined) { return { title: page?.title ?? "", slug: page?.slug ?? "", template: page?.template ?? "default", status: page?.status ?? "draft", seoTitle: page?.seoTitle ?? "", seoDescription: page?.seoDescription ?? "", canonicalUrl: page?.canonicalUrl ?? "", scheduledAt: formatLocalDateTime(page?.scheduledAt), blocks: page?.blocks ?? [] }; }
const statusOptions = [["draft", "Bản nháp"], ["review", "Chờ duyệt"], ["scheduled", "Hẹn giờ"], ["published", "Xuất bản"], ["archived", "Lưu trữ"]] as const;
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
  const pageType = fixedPage ? "Trang hệ thống" : "Trang tự tạo";
  const publicPath = fixedPage?.publicPath ?? (form.slug ? `/trang/${form.slug}` : "Sẽ tạo sau khi nhập slug");
  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || uploading.current || restoring.current || !isDirty) return;
    saving.current = true;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: page?.id ?? null, expectedVersion: savedVersion, values: { ...form, seoTitle: form.seoTitle || null, seoDescription: form.seoDescription || null, canonicalUrl: form.canonicalUrl || null, scheduledAt: form.scheduledAt || null } }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Không thể lưu trang.");
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

  return <AdminDetailPanel actions={<PublishedPreviewLink kind="page" slug={page?.slug} status={page?.status} />} backHref="/admin/pages" description={`Đường dẫn hiển thị: ${publicPath}`} eyebrow={pageType} hasUnsavedChanges={isDirty} title={page?.title ?? "Tạo trang mới"}>
    <form id="page-editor" className="grid gap-5" onSubmit={submit}>
      <fieldset className="grid min-w-0 gap-5 border-0 p-0 disabled:opacity-70" disabled={processing}>
      <EditorCard title="Nội dung" description="Sắp xếp các khối nội dung theo thứ tự hiển thị trên trang."><PageBlocksEditor blocks={form.blocks as PageBlock[]} disabled={processing} onUploadingChange={handleUploadingChange} onChange={blocks => set("blocks", blocks)} /></EditorCard>
      <EditorCard title="Xuất bản" description="Chọn thời điểm trang xuất hiện hoặc ngừng hiển thị trên website."><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-bold text-[var(--cms-text)]">Trạng thái<select className="rounded-lg border border-[var(--cms-border)] bg-[var(--cms-card)] px-3 py-2 font-normal" value={form.status} onChange={event => set("status", event.target.value as typeof form.status)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-2 text-sm font-bold text-[var(--cms-text)]">Thời điểm xuất bản<input className="rounded-lg border border-[var(--cms-border)] px-3 py-2 font-normal" type="datetime-local" value={form.scheduledAt} onChange={event => set("scheduledAt", event.target.value)} disabled={form.status !== "scheduled"} /></label></div></EditorCard>
      <EditorCard title="Media" description="Trang chưa có ảnh bìa riêng trong dữ liệu hiện tại. Để dùng ảnh, thêm khối “Hình ảnh” ở phần Nội dung và chọn tệp từ thư viện media."><Link className="inline-flex justify-self-start rounded-lg border border-[var(--cms-border)] px-3 py-2 text-sm font-bold text-[var(--cms-text)] hover:border-blue-300 hover:text-blue-700" href="/admin/media" target="_blank">Mở thư viện media ↗</Link></EditorCard>
      <EditorCard title="Thuộc tính trang" description="Thông tin nhận diện và đường dẫn của trang."><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-bold text-[var(--cms-text)] md:col-span-2">Tiêu đề trang<input className="rounded-lg border border-[var(--cms-border)] px-3 py-2 font-normal" required value={form.title} onChange={event => set("title", event.target.value)} /></label><div className="grid gap-2 text-sm font-bold text-[var(--cms-text)]"><span>Loại trang</span><span className="justify-self-start rounded-full bg-[var(--cms-hover)] px-3 py-2 text-sm font-bold text-[var(--cms-text)]">{pageType}</span></div>{fixedPage ? <div className="grid gap-2 text-sm font-bold text-[var(--cms-text)]"><span>Đường dẫn</span><span className="rounded-lg border border-[var(--cms-border)] bg-[var(--cms-hover)] px-3 py-2 font-normal text-[var(--cms-muted)]">{fixedPage.publicPath}</span></div> : <label className="grid gap-2 text-sm font-bold text-[var(--cms-text)]">Slug<input className="rounded-lg border border-[var(--cms-border)] px-3 py-2 font-normal" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={event => set("slug", event.target.value)} placeholder="gioi-thieu-san-pham" /></label>}</div></EditorCard>
      <EditorCard title="SEO" description="Thông tin hỗ trợ công cụ tìm kiếm và nội dung khi chia sẻ liên kết."><div className="grid gap-4"><label className="grid gap-2 text-sm font-bold text-[var(--cms-text)]">Tiêu đề SEO<input className="rounded-lg border border-[var(--cms-border)] px-3 py-2 font-normal" maxLength={70} value={form.seoTitle} onChange={event => set("seoTitle", event.target.value)} /></label><label className="grid gap-2 text-sm font-bold text-[var(--cms-text)]">Mô tả SEO<textarea className="min-h-28 rounded-lg border border-[var(--cms-border)] px-3 py-2 font-normal" maxLength={180} value={form.seoDescription} onChange={event => set("seoDescription", event.target.value)} /></label><label className="grid gap-2 text-sm font-bold text-[var(--cms-text)]">URL chuẩn<input className="rounded-lg border border-[var(--cms-border)] px-3 py-2 font-normal" type="url" value={form.canonicalUrl} onChange={event => set("canonicalUrl", event.target.value)} placeholder="https://…" /></label></div></EditorCard>
      {page ? <EditorCard title="Lịch sử phiên bản" description="Có thể xem và khôi phục phiên bản đã lưu trước đó."><RevisionHistory target="pages" id={page.id} expectedVersion={savedVersion} disabled={processing || isDirty} onRestorePendingChange={handleRestorePendingChange} onRestored={() => router.refresh()} /></EditorCard> : null}
      </fieldset>
      <AdminEditorActions><p className={`mb-0 text-sm ${isDirty ? "text-amber-700" : "text-[var(--cms-muted)]"}`} role="status">{isUploading ? "Đang tải ảnh nội dung…" : busy ? "Đang lưu trang…" : isDirty ? "Có thay đổi chưa lưu." : message || "Không có thay đổi chưa lưu."}</p>{isDirty ? <AdminButton disabled={processing} variant="secondary" onClick={() => {
        if (saving.current || uploading.current || restoring.current) return;
        setForm(getSavedValue());
        setMessage("");
      }}>Bỏ thay đổi</AdminButton> : null}<AdminButton disabled={processing || !isDirty} type="submit">{busy ? "Đang lưu…" : "Lưu thay đổi"}</AdminButton></AdminEditorActions>
    </form>
  </AdminDetailPanel>;
}

function EditorCard({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="admin-content-section grid gap-5 rounded-xl border p-4 sm:p-5"><header><h2 className="mb-2 text-base font-extrabold text-[var(--cms-text)]">{title}</h2><p className="mb-0 max-w-3xl text-sm leading-6 text-[var(--cms-muted)]">{description}</p></header>{children}</section>; }
