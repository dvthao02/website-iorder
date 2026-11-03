"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FileText } from "lucide-react";

import { adminPostInputSchema, type AdminPostInput } from "@iorder/core/server/posts/posts.contract";
import type { RichDocument } from "@iorder/core/server/shared/rich-text";
import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { toSlug } from "@/lib/slug";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "@/components/admin/ui/admin-feedback";
import { AdminSidePanel } from "@/components/admin/ui/admin-side-panel";
import { importFile } from "@/components/admin/rich-text/import-content";
import { htmlToRichDocument, uploadContentImage } from "@/components/admin/rich-text/schema";

const maxFiles = 20;
const newsTypes = { news: "Tin tức", promotion: "Khuyến mãi", case_study: "Câu chuyện khách hàng", announcement: "Thông báo" } as const;
type NewsType = keyof typeof newsTypes;
type Existing = { id: string; type: string; status: string };
type Row = { file: File; title: string; slug: string; words: number; images: number; warnings: string[]; existing: Existing | null; error: string | null };
type Outcome = { name: string; ok: boolean; message: string; href?: string };

const liveStatuses = new Set(["published", "scheduled"]);
const fileTitle = (name: string) => name.replace(/\.docx$/i, "").replace(/[_-]+/g, " ").trim();

async function findPostBySlug(slug: string): Promise<Existing | null> {
  const response = await fetch(`/api/admin/posts?view=summary&pageSize=25&query=${encodeURIComponent(slug)}`);
  const payload = await readAdminJson(response);
  if (!response.ok) throw adminApiError(payload, "Không kiểm tra được bài viết đã có.");
  const items: Array<Existing & { slug: string }> = payload?.result?.items ?? [];
  return items.find((item) => item.slug === slug) ?? null;
}

/** Đọc file Word như khi nhập trong trình soạn thảo; uploadImage = null thì chỉ đếm ảnh (xem trước, chưa tải lên). */
async function convert(file: File, upload: ((image: File) => Promise<string>) | null) {
  let images = 0;
  const result = await importFile(file, upload ?? (async () => { images++; return "/media/xem-truoc"; }));
  const doc = htmlToRichDocument(result.html);
  const words = (new DOMParser().parseFromString(result.html, "text/html").body.textContent ?? "").split(/\s+/).filter(Boolean).length;
  return { title: result.title?.trim() || fileTitle(file.name), doc, words, images, warnings: result.warnings };
}

/**
 * Nhập nhiều file Word thành bài viết: chuyển nội dung y như nút "Nhập file" của trình soạn thảo (tiêu đề = Heading 1 đầu tiên,
 * ảnh đưa vào Thư viện media khi áp dụng). Bài mới là bản nháp; đường dẫn đã có thì chỉ thay nội dung (giữ tiêu đề, SEO, ảnh bìa…).
 */
export function WordImportPanel({ kind, onClose }: { kind: "posts" | "guides"; onClose: () => void }) {
  const router = useRouter();
  const { show } = useAdminToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [type, setType] = useState<NewsType>("news");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const guides = kind === "guides";
  const noun = guides ? "hướng dẫn" : "bài viết";
  const ready = rows?.filter((row) => !row.error) ?? [];

  async function choose(event: FormEvent<HTMLInputElement>) {
    const files = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = "";
    setRows(null); setOutcomes(null); setError("");
    if (!files.length) return;
    if (files.length > maxFiles) { setError(`Mỗi lần nhập tối đa ${maxFiles} file.`); return; }
    const next: Row[] = [];
    const seen = new Set<string>();
    try {
      for (const [index, file] of files.entries()) {
        setBusy(`Đang đọc file ${index + 1}/${files.length}: ${file.name}`);
        if (!/\.docx$/i.test(file.name)) { next.push({ file, title: file.name, slug: "", words: 0, images: 0, warnings: [], existing: null, error: "Chỉ nhận file Word .docx (file .doc cũ: mở bằng Word rồi Lưu thành .docx)." }); continue; }
        try {
          const converted = await convert(file, null);
          const slug = toSlug(converted.title);
          const existing = slug ? await findPostBySlug(slug) : null;
          const rowError = !slug ? "Không lấy được tiêu đề (cần Heading 1 hoặc tên file có chữ)."
            : seen.has(slug) ? "Trùng tiêu đề/đường dẫn với một file khác trong lần nhập này."
            : existing && (existing.type === "guide") !== guides ? `Đường dẫn "${slug}" đã dùng cho một ${guides ? "bài viết" : "hướng dẫn"}; hãy đổi tiêu đề trong file.`
            : !converted.words && !converted.images ? "File không có nội dung." : null;
          seen.add(slug);
          next.push({ file, title: converted.title, slug, words: converted.words, images: converted.images, warnings: converted.warnings.filter((warning) => !warning.startsWith("Đã tải")), existing, error: rowError });
        } catch (cause) {
          next.push({ file, title: file.name, slug: "", words: 0, images: 0, warnings: [], existing: null, error: cause instanceof Error ? cause.message : "Không đọc được file." });
        }
      }
      setRows(next);
    } finally {
      setBusy("");
    }
  }

  async function apply() {
    if (!ready.length || busy) return;
    const results: Outcome[] = [];
    try {
      for (const [index, row] of ready.entries()) {
        setBusy(`Đang nhập ${index + 1}/${ready.length}: ${row.title}`);
        try {
          const { doc } = await convert(row.file, uploadContentImage);
          const content = { version: 2 as const, doc: doc as RichDocument };
          if (row.existing) {
            // Thay nội dung bài đã có: đọc bản mới nhất để gửi đúng phiên bản (máy chủ trả 409 nếu vừa có người sửa).
            const current = await readAdminJson(await fetch(`/api/admin/posts/${row.existing.id}`));
            const post = current?.post as (AdminPostInput & { draftVersion: number }) | undefined;
            if (!post) throw new Error("Không đọc được bài viết đã có.");
            const values = Object.fromEntries(Object.keys(adminPostInputSchema.shape).map((key) => [key, Reflect.get(post, key)]));
            const response = await fetch(`/api/admin/posts/${row.existing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...values, content, expectedVersion: post.draftVersion }) });
            const payload = await readAdminJson(response);
            if (!response.ok) throw adminApiError(payload, "Không cập nhật được nội dung.");
            results.push({ name: row.file.name, ok: true, message: "Đã thay nội dung (tạo phiên bản mới).", href: `/admin/${guides ? "guides" : "news"}/${row.existing.id}` });
          } else {
            const input: AdminPostInput = { coverMediaId: null, type: guides ? "guide" : type, title: row.title.slice(0, 220), slug: row.slug, excerpt: null, content, status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null,
              promotionStartAt: null, promotionEndAt: null, ctaLabel: null, ctaUrl: null, badgeText: null, scheduledAt: null, categoryIds: [], tagIds: [] };
            const response = await fetch("/api/admin/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
            const payload = await readAdminJson(response);
            if (!response.ok || typeof payload?.post?.id !== "string") throw adminApiError(payload, "Không tạo được bài nháp.");
            results.push({ name: row.file.name, ok: true, message: "Đã tạo bản nháp.", href: `/admin/${guides ? "guides" : "news"}/${payload.post.id}` });
          }
        } catch (cause) {
          results.push({ name: row.file.name, ok: false, message: cause instanceof Error ? cause.message : "Không nhập được file này." });
        }
      }
    } finally {
      setBusy("");
      setOutcomes(results);
      setRows(null);
      router.refresh();
    }
    const done = results.filter((result) => result.ok).length;
    show(`Đã nhập ${done}/${results.length} file Word.`, done === results.length ? "success" : "warning");
  }

  return <AdminSidePanel isOpen label={`Nhập ${noun} từ Word`} onClose={busy ? () => undefined : onClose} footer={<>
    <AdminButton disabled={Boolean(busy)} onClick={onClose} variant="secondary">Đóng</AdminButton>
    {rows ? <AdminButton disabled={Boolean(busy) || !ready.length} onClick={() => void apply()}>{busy ? "Đang nhập…" : `Nhập ${ready.length} file`}</AdminButton> : null}
  </>}>
    <div className="admin-import">
      <header><h2>Nhập {noun} từ Word</h2><p>Mỗi file .docx thành một {noun}: <strong>Heading 1</strong> đầu tiên là tiêu đề (không có thì lấy tên file), phần còn lại là nội dung — đậm/nghiêng, danh sách, bảng, liên kết, ảnh được giữ.</p></header>
      <ol className="admin-import__steps">
        <li>Chọn tối đa {maxFiles} file .docx. Xem trước chưa tải ảnh lên.</li>
        <li>{noun[0].toLocaleUpperCase("vi")}{noun.slice(1)} mới được tạo ở trạng thái <strong>Bản nháp</strong>, chưa hiện trên website. Tiêu đề trùng {noun} đã có thì <strong>chỉ thay nội dung</strong> bài đó (giữ tiêu đề, SEO, ảnh bìa; khôi phục được bằng lịch sử phiên bản).</li>
      </ol>
      {!guides ? <label className="admin-field">Loại cho bài mới<select disabled={Boolean(busy)} onChange={(event) => setType(event.target.value as NewsType)} value={type}>{Object.entries(newsTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
      <label className="admin-import__file"><FileText aria-hidden="true" size={18} /><span>{rows ? `${rows.length} file đã chọn — chọn lại` : "Chọn file Word (.docx)"}</span><input accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={Boolean(busy)} multiple onChange={(event) => void choose(event)} type="file" /></label>
      {busy ? <AdminNotice tone="info">{busy}</AdminNotice> : null}
      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {rows ? <ul className="admin-import__rows">{rows.map((row) => <li className={`admin-import__row admin-import__row--${row.error ? "error" : row.existing ? "update" : "create"}`} key={row.file.name + row.file.lastModified}>
        <div><strong>{row.title}</strong><small>{row.file.name}{row.slug ? ` · ${row.slug}` : ""}</small><AdminStatusBadge tone={row.error ? "error" : row.existing ? "info" : "success"}>{row.error ? "Lỗi" : row.existing ? "Thay nội dung" : "Tạo bản nháp"}</AdminStatusBadge></div>
        {row.error ? <ul className="admin-import__errors"><li>{row.error}</li></ul> : <ul className="admin-import__changes">
          <li><span>Nội dung:</span> {row.words} từ{row.images ? `, ${row.images} ảnh (tải lên khi nhập)` : ""}</li>
          {row.existing && liveStatuses.has(row.existing.status) ? <li><span>Lưu ý:</span> bài đang hiện trên website — nội dung mới hiện ngay sau khi nhập (cần quyền xuất bản).</li> : null}
          {row.warnings.map((warning) => <li key={warning}><span>Ghi chú:</span> {warning}</li>)}
        </ul>}
      </li>)}</ul> : null}
      {outcomes ? <ul className="admin-import__rows">{outcomes.map((outcome) => <li className={`admin-import__row admin-import__row--${outcome.ok ? "create" : "error"}`} key={outcome.name}>
        <div><strong>{outcome.name}</strong><AdminStatusBadge tone={outcome.ok ? "success" : "error"}>{outcome.ok ? "Xong" : "Lỗi"}</AdminStatusBadge></div>
        <ul className={outcome.ok ? "admin-import__changes" : "admin-import__errors"}><li>{outcome.message}{outcome.href ? <> · <Link href={outcome.href}>Mở {noun}</Link></> : null}</li></ul>
      </li>)}</ul> : null}
    </div>
  </AdminSidePanel>;
}
