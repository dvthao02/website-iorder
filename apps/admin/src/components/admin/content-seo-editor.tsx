"use client";

import { useId, useRef } from "react";
import type { ContentSeo, StructuredDataDocument } from "@iorder/shared/server/shared/content-seo";
import { MediaPicker } from "./media-picker";
import { AdminButton } from "./ui/admin-button";
import { AdminFaqEditor } from "./ui/admin-list-editor";
import { AdminFormField } from "./ui/admin-form-field";

function SeoTextField({ label, value, onChange, multiline = false, maxLength = 2000, url = false }: { label: string; value?: string; onChange: (value: string) => void; multiline?: boolean; maxLength?: number; url?: boolean }) {
  const id = useId();
  return <AdminFormField id={id} label={label}>{multiline ? <textarea id={id} maxLength={maxLength} onChange={event => onChange(event.target.value)} value={value ?? ""} /> : <input id={id} maxLength={maxLength} onChange={event => onChange(event.target.value)} type={url ? "url" : "text"} value={value ?? ""} />}</AdminFormField>;
}

/** SEO mở rộng độc lập với Rich Text/Page Builder; dùng chung cho pages, posts và offerings. */
export function ContentSeoEditor({ value, onChange, title, description, disabled = false, onUploadingChange }: { value: ContentSeo; onChange: (value: ContentSeo) => void; title: string; description: string; disabled?: boolean; onUploadingChange?: (pending: boolean) => void }) {
  const uploads = useRef(new Set<string>());
  const track = (key: string, pending: boolean) => { if (pending) uploads.current.add(key); else uploads.current.delete(key); onUploadingChange?.(uploads.current.size > 0); };
  const set = (patch: Partial<ContentSeo>) => onChange({ ...value, ...patch });
  const documents = value.structuredData ?? [];
  const setDocument = (index: number, patch: Partial<StructuredDataDocument>) => set({ structuredData: documents.map((document, current) => current === index ? { ...document, ...patch } : document) });
  const robotsChoice = (key: "index" | "follow" | "sitemap" | "breadcrumbs", label: string, yes: string, no: string) => <label className="admin-field">{label}<select onChange={event => set({ [key]: event.target.value === "inherit" ? undefined : event.target.value === "yes" })} value={value[key] === undefined ? "inherit" : value[key] ? "yes" : "no"}><option value="inherit">Theo cấu hình mặc định</option><option value="yes">{yes}</option><option value="no">{no}</option></select></label>;
  return <fieldset className="grid min-w-0 gap-4" disabled={disabled}>
    <legend className="sr-only">Thiết lập SEO mở rộng</legend>
    <details className="admin-post-editor__panel"><summary><strong>Thu thập dữ liệu, sitemap và breadcrumb</strong></summary><div className="admin-post-editor__panel-body">
      <div className="admin-form-grid">{robotsChoice("index", "Cho phép xuất hiện trên công cụ tìm kiếm", "Cho phép (index)", "Không cho phép (noindex)")}{robotsChoice("follow", "Cho phép theo liên kết trong trang", "Cho phép (follow)", "Không cho phép (nofollow)")}{robotsChoice("sitemap", "Đưa vào sitemap XML", "Có", "Không")}{robotsChoice("breadcrumbs", "Dữ liệu đường dẫn phân cấp", "Có", "Không")}</div>
      <p className="admin-help">Trang noindex tự loại khỏi sitemap. Cấu hình ngăn lập chỉ mục của toàn website luôn được ưu tiên.</p>
    </div></details>
    <details className="admin-post-editor__panel"><summary><strong>Open Graph và Twitter/X</strong></summary><div className="admin-post-editor__panel-body">
      <p className="admin-help">Để trống để dùng tiêu đề, mô tả SEO và ảnh bìa hiện có.</p>
      <SeoTextField label="Tiêu đề chia sẻ Facebook/Zalo" value={value.openGraph?.title} maxLength={220} onChange={next => set({ openGraph: { ...value.openGraph, title: next } })} />
      <SeoTextField label="Mô tả chia sẻ Facebook/Zalo" value={value.openGraph?.description} multiline onChange={next => set({ openGraph: { ...value.openGraph, description: next } })} />
      <MediaPicker compact disabled={disabled} label="Ảnh chia sẻ Facebook/Zalo" onChange={imageMediaId => set({ openGraph: { ...value.openGraph, imageMediaId } })} onUploadingChange={pending => track("og", pending)} value={value.openGraph?.imageMediaId ?? null} />
      <SeoTextField label="Tiêu đề chia sẻ Twitter/X" value={value.twitter?.title} maxLength={220} onChange={next => set({ twitter: { ...value.twitter, title: next } })} />
      <SeoTextField label="Mô tả chia sẻ Twitter/X" value={value.twitter?.description} multiline onChange={next => set({ twitter: { ...value.twitter, description: next } })} />
      <label className="admin-field">Kiểu thẻ Twitter/X<select value={value.twitter?.card ?? "summary_large_image"} onChange={event => set({ twitter: { ...value.twitter, card: event.target.value as "summary" | "summary_large_image" } })}><option value="summary_large_image">Ảnh lớn</option><option value="summary">Tóm tắt</option></select></label>
      <MediaPicker compact disabled={disabled} label="Ảnh chia sẻ Twitter/X" onChange={imageMediaId => set({ twitter: { ...value.twitter, imageMediaId } })} onUploadingChange={pending => track("twitter", pending)} value={value.twitter?.imageMediaId ?? null} />
      <div aria-label="Xem trước chia sẻ" className="admin-content-section"><small className="admin-help">Facebook/Zalo</small><strong>{value.openGraph?.title || title}</strong><p>{value.openGraph?.description || description}</p><small className="admin-help">Twitter/X</small><strong>{value.twitter?.title || value.openGraph?.title || title}</strong><p>{value.twitter?.description || value.openGraph?.description || description}</p></div>
    </div></details>
    <details className="admin-post-editor__panel"><summary><strong>Dữ liệu cấu trúc (JSON-LD)</strong></summary><div className="admin-post-editor__panel-body">
      <label className="admin-field">Cách tạo dữ liệu cấu trúc<select value={value.structuredData === undefined ? "auto" : documents.length ? "custom" : "none"} onChange={event => set({ structuredData: event.target.value === "auto" ? undefined : event.target.value === "none" ? [] : [{ type: "WebPage" }] })}><option value="auto">Tự động theo loại trang</option><option value="custom">Thiết lập riêng</option><option value="none">Không thêm schema nội dung</option></select></label>
      <p className="admin-help">Thiết lập qua các trường bên dưới; hệ thống tự tạo JSON-LD hợp lệ. Chỉ khai báo thông tin có thật và hiển thị trên trang.</p>
      {documents.map((document, index) => <details className="admin-post-editor__panel" key={index} open={index === 0}><summary><strong>{index + 1}. {document.type}</strong></summary><div className="admin-post-editor__panel-body">
        <label className="admin-field">Loại schema<select onChange={event => setDocument(index, { type: event.target.value as StructuredDataDocument["type"] })} value={document.type}>{["WebPage", "Article", "Service", "Product", "Organization", "FAQPage"].map(type => <option key={type}>{type}</option>)}</select></label>
        <SeoTextField label="Tên hoặc tiêu đề schema" value={document.name} maxLength={220} onChange={name => setDocument(index, { name })} />
        <SeoTextField label="Mô tả schema" value={document.description} multiline onChange={description => setDocument(index, { description })} />
        <SeoTextField label="Địa chỉ schema (tùy chọn)" value={document.url} url onChange={url => setDocument(index, { url: url || undefined })} />
        <MediaPicker compact disabled={disabled} label="Ảnh schema" value={document.imageMediaId ?? null} onChange={imageMediaId => setDocument(index, { imageMediaId })} onUploadingChange={pending => track(`schema-${index}`, pending)} />
        {document.type === "Article" ? <SeoTextField label="Tác giả" value={document.author} maxLength={180} onChange={author => setDocument(index, { author })} /> : null}
        {document.type === "Product" ? <><SeoTextField label="Thương hiệu" value={document.brand} maxLength={180} onChange={brand => setDocument(index, { brand })} /><SeoTextField label="Mã sản phẩm" value={document.sku} maxLength={120} onChange={sku => setDocument(index, { sku })} /><label className="admin-field">Giá công khai (tùy chọn)<input min={0} type="number" value={document.price ?? ""} onChange={event => setDocument(index, { price: event.target.value === "" ? undefined : Number(event.target.value), currency: document.currency ?? "VND" })} /></label><label className="admin-field">Đơn vị tiền tệ<select value={document.currency ?? "VND"} onChange={event => setDocument(index, { currency: event.target.value })}><option>VND</option><option>USD</option></select></label></> : null}
        {document.type === "FAQPage" ? <AdminFaqEditor items={document.questions ?? []} maxItems={50} onChange={questions => setDocument(index, { questions })} /> : null}
        <div className="flex flex-wrap gap-2"><AdminButton disabled={index === 0} onClick={() => { const next = [...documents]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; set({ structuredData: next }); }} size="sm" variant="secondary">Đưa lên</AdminButton><AdminButton onClick={() => set({ structuredData: documents.filter((_, current) => current !== index) })} size="sm" variant="danger">Xóa schema</AdminButton></div>
      </div></details>)}
      {value.structuredData !== undefined && documents.length > 0 && documents.length < 10 ? <AdminButton onClick={() => set({ structuredData: [...documents, { type: "WebPage" }] })} size="sm" variant="secondary">Thêm schema</AdminButton> : null}
    </div></details>
  </fieldset>;
}
