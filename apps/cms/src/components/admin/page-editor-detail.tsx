"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { getFixedWebsitePage, type AdminPage, type PageBlock } from "@iorder/core/server/pages/pages.contract";

import { PageBlocksEditor } from "./page-blocks-editor";
import { PublishedPreviewLink } from "./published-preview-link";
import { RevisionHistory } from "./revision-history";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { AdminDetailPanel } from "./ui/admin-detail-panel";
import { useAdminToast } from "./ui/admin-feedback";

function toForm(page: AdminPage | undefined) { return { title: page?.title ?? "", slug: page?.slug ?? "", template: page?.template ?? "default", status: page?.status ?? "draft", seoTitle: page?.seoTitle ?? "", seoDescription: page?.seoDescription ?? "", canonicalUrl: page?.canonicalUrl ?? "", scheduledAt: page?.scheduledAt ? new Date(page.scheduledAt).toISOString().slice(0, 16) : "", blocks: page?.blocks ?? [] }; }
const statusOptions = [["draft", "Bản nháp"], ["review", "Chờ duyệt"], ["scheduled", "Hẹn giờ"], ["published", "Xuất bản"], ["archived", "Lưu trữ"]] as const;

export function PageEditorDetail({ page }: { page?: AdminPage }) {
  const router = useRouter();
  const [form, setForm] = useState(() => toForm(page));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { isDirty, markSaved } = useUnsavedChanges(form);
  const { show: showToast } = useAdminToast();
  const fixedPage = page ? getFixedWebsitePage(page.slug) : undefined;
  const pageType = fixedPage ? "Trang hệ thống" : "Trang tự tạo";
  const publicPath = fixedPage?.publicPath ?? (form.slug ? `/trang/${form.slug}` : "Sẽ tạo sau khi nhập slug");
  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: page?.id ?? null, values: { ...form, seoTitle: form.seoTitle || null, seoDescription: form.seoDescription || null, canonicalUrl: form.canonicalUrl || null, scheduledAt: form.scheduledAt || null } }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Không thể lưu trang.");
      markSaved();
      setMessage("Đã lưu thay đổi và tạo phiên bản mới.");
      showToast("Đã lưu thay đổi và tạo phiên bản mới.", "success");
      if (!page) router.replace(`/admin/pages/${payload.page.id}`);
      router.refresh();
    } catch (error) { const notice = error instanceof Error ? error.message : "Không thể lưu trang lúc này."; setMessage(notice); showToast(notice, "error"); }
    finally { setBusy(false); }
  }

  return <AdminDetailPanel actions={<PublishedPreviewLink kind="page" slug={page?.slug} status={page?.status} />} backHref="/admin/pages" description={`Đường dẫn hiển thị: ${publicPath}`} eyebrow={pageType} hasUnsavedChanges={isDirty} title={page?.title ?? "Tạo trang mới"}>
    <form id="page-editor" className="grid gap-5" onSubmit={submit}>
      <EditorCard title="Nội dung" description="Sắp xếp các khối nội dung theo thứ tự hiển thị trên trang."><PageBlocksEditor blocks={form.blocks as PageBlock[]} onChange={blocks => set("blocks", blocks)} /></EditorCard>
      <EditorCard title="Xuất bản" description="Chọn thời điểm trang xuất hiện hoặc ngừng hiển thị trên website."><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-bold text-slate-700">Trạng thái<select className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" value={form.status} onChange={event => set("status", event.target.value as typeof form.status)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-2 text-sm font-bold text-slate-700">Thời điểm xuất bản<input className="rounded-lg border border-slate-300 px-3 py-2 font-normal" type="datetime-local" value={form.scheduledAt} onChange={event => set("scheduledAt", event.target.value)} disabled={form.status !== "scheduled"} /></label></div></EditorCard>
      <EditorCard title="Media" description="Trang chưa có ảnh bìa riêng trong dữ liệu hiện tại. Để dùng ảnh, thêm khối “Hình ảnh” ở phần Nội dung và chọn tệp từ thư viện media."><Link className="inline-flex justify-self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700" href="/admin/media" target="_blank">Mở thư viện media ↗</Link></EditorCard>
      <EditorCard title="Thuộc tính trang" description="Thông tin nhận diện và đường dẫn của trang."><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">Tiêu đề trang<input className="rounded-lg border border-slate-300 px-3 py-2 font-normal" required value={form.title} onChange={event => set("title", event.target.value)} /></label><div className="grid gap-2 text-sm font-bold text-slate-700"><span>Loại trang</span><span className="justify-self-start rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">{pageType}</span></div>{fixedPage ? <div className="grid gap-2 text-sm font-bold text-slate-700"><span>Đường dẫn</span><span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal text-slate-600">{fixedPage.publicPath}</span></div> : <label className="grid gap-2 text-sm font-bold text-slate-700">Slug<input className="rounded-lg border border-slate-300 px-3 py-2 font-normal" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={event => set("slug", event.target.value)} placeholder="gioi-thieu-san-pham" /></label>}</div></EditorCard>
      <EditorCard title="SEO" description="Thông tin hỗ trợ công cụ tìm kiếm và nội dung khi chia sẻ liên kết."><div className="grid gap-4"><label className="grid gap-2 text-sm font-bold text-slate-700">Tiêu đề SEO<input className="rounded-lg border border-slate-300 px-3 py-2 font-normal" maxLength={70} value={form.seoTitle} onChange={event => set("seoTitle", event.target.value)} /></label><label className="grid gap-2 text-sm font-bold text-slate-700">Mô tả SEO<textarea className="min-h-28 rounded-lg border border-slate-300 px-3 py-2 font-normal" maxLength={180} value={form.seoDescription} onChange={event => set("seoDescription", event.target.value)} /></label><label className="grid gap-2 text-sm font-bold text-slate-700">URL chuẩn<input className="rounded-lg border border-slate-300 px-3 py-2 font-normal" type="url" value={form.canonicalUrl} onChange={event => set("canonicalUrl", event.target.value)} placeholder="https://…" /></label></div></EditorCard>
      {page ? <EditorCard title="Lịch sử phiên bản" description="Có thể xem và khôi phục phiên bản đã lưu trước đó."><RevisionHistory target="pages" id={page.id} /></EditorCard> : null}
      <AdminEditorActions><p className={`mb-0 text-sm ${isDirty ? "text-amber-700" : "text-slate-600"}`} role="status">{isDirty ? "Có thay đổi chưa lưu." : message}</p><button className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></AdminEditorActions>
    </form>
  </AdminDetailPanel>;
}

function EditorCard({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="admin-content-section grid gap-5 rounded-xl border p-4 sm:p-5"><header><h2 className="mb-2 text-base font-extrabold text-[var(--cms-text)]">{title}</h2><p className="mb-0 max-w-3xl text-sm leading-6 text-[var(--cms-muted)]">{description}</p></header>{children}</section>; }
