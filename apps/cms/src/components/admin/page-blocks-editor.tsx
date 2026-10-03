"use client";

import type { ReactNode } from "react";

import type { PageBlock } from "@iorder/core/server/pages/pages.contract";

import { MediaPicker } from "./media-picker";

type BlockType = PageBlock["type"];
type CardBlock = Extract<PageBlock, { type: "features" | "industries" | "ecosystem" | "process" }>;
type Action = { label: string; href: string };

const blockOptions: ReadonlyArray<{ value: BlockType; label: string }> = [
  { value: "hero", label: "Mở đầu" },
  { value: "stats", label: "Số liệu nổi bật" },
  { value: "features", label: "Tính năng" },
  { value: "industries", label: "Ngành nghề" },
  { value: "ecosystem", label: "Hệ sinh thái" },
  { value: "process", label: "Quy trình" },
  { value: "testimonials", label: "Cảm nhận khách hàng" },
  { value: "partners", label: "Đối tác và khách hàng" },
  { value: "featured_posts", label: "Bài viết nổi bật" },
  { value: "faq", label: "Câu hỏi thường gặp" },
  { value: "cta", label: "Kêu gọi hành động" },
  { value: "lead_form", label: "Biểu mẫu nhận tư vấn" },
  { value: "rich_text", label: "Nội dung văn bản" },
  { value: "image", label: "Hình ảnh" },
  { value: "download_list", label: "Danh sách tải về" },
];

function newBlock(type: BlockType): PageBlock {
  switch (type) {
    case "hero": return { type, isEnabled: true, data: { eyebrow: null, title: "Tiêu đề mới", description: null, primaryAction: null, secondaryAction: null } };
    case "stats": return { type, isEnabled: true, data: { eyebrow: null, title: null, items: [{ value: "0", label: "Nhãn số liệu", note: null }] } };
    case "features":
    case "industries":
    case "ecosystem":
    case "process": return { type, isEnabled: true, data: { eyebrow: null, title: "Tiêu đề mới", description: null, items: [{ title: "Mục mới", description: "Mô tả", href: null }] } };
    case "testimonials": return { type, isEnabled: true, data: { eyebrow: null, title: "Khách hàng nói gì", limit: 6 } };
    case "partners": return { type, isEnabled: true, data: { eyebrow: null, title: "Đối tác và khách hàng", kind: "all", limit: 12 } };
    case "featured_posts": return { type, isEnabled: true, data: { eyebrow: null, title: "Bài viết nổi bật", limit: 3 } };
    case "faq": return { type, isEnabled: true, data: { eyebrow: null, title: "Câu hỏi thường gặp", items: [{ question: "Câu hỏi mới", answer: "Nội dung trả lời" }] } };
    case "cta": return { type, isEnabled: true, data: { id: null, eyebrow: null, title: "Sẵn sàng bắt đầu?", action: { label: "Liên hệ tư vấn", href: "/lien-he" } } };
    case "lead_form": return { type, isEnabled: true, data: { title: "Nhận tư vấn", description: null, submitLabel: "Gửi yêu cầu", needOptions: [] } };
    case "rich_text": return { type, isEnabled: true, data: { heading: null, body: "Nội dung mới" } };
    case "image": return { type, isEnabled: true, data: { mediaId: "", alt: null, caption: null } };
    case "download_list": return { type, isEnabled: true, data: { eyebrow: null, title: "Tài liệu tải về" } };
  }
}

function changePosition<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const result = [...items];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

function Field({ label, value, onChange, multiline = false, type = "text", min }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; type?: "text" | "url" | "number"; min?: number }) {
  return <label className="grid gap-1 text-sm font-medium">{label}{multiline ? <textarea className="min-h-24 rounded border p-2 font-normal" value={value} onChange={event => onChange(event.target.value)} /> : <input className="rounded border p-2 font-normal" type={type} min={min} value={value} onChange={event => onChange(event.target.value)} />}</label>;
}

function NullableField({ label, value, onChange, multiline = false, type = "text" }: { label: string; value: string | null; onChange: (value: string | null) => void; multiline?: boolean; type?: "text" | "url" }) {
  return <Field label={label} value={value ?? ""} multiline={multiline} type={type} onChange={next => onChange(next.trim() || null)} />;
}

function NumberField({ label, value, onChange, max }: { label: string; value: number; onChange: (value: number) => void; max?: number }) {
  return <Field label={label} type="number" min={1} value={String(value)} onChange={next => onChange(Math.max(1, Math.min(max ?? Number.MAX_SAFE_INTEGER, Number(next) || 1)))} />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="grid gap-3 rounded border border-slate-200 p-4"><legend className="px-1 font-semibold">{title}</legend>{children}</fieldset>;
}

function ListButtons({ index, length, onMove, onDelete }: { index: number; length: number; onMove: (direction: -1 | 1) => void; onDelete: () => void }) {
  return <div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => onMove(-1)}>Lên</button><button type="button" disabled={index === length - 1} onClick={() => onMove(1)}>Xuống</button><button type="button" className="text-red-700" onClick={onDelete}>Xóa</button></div>;
}

function ActionFields({ title, value, onChange, optional = true }: { title: string; value: Action | null; onChange: (value: Action | null) => void; optional?: boolean }) {
  const active = value !== null;
  return <Section title={title}>{optional ? <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={event => onChange(event.target.checked ? { label: "Xem thêm", href: "/lien-he" } : null)} />Hiển thị nút này</label> : null}{active ? <div className="grid gap-3 md:grid-cols-2"><Field label="Nhãn nút" value={value.label} onChange={label => onChange({ ...value, label })} /><Field label="Đường dẫn (ví dụ /lien-he hoặc https://...)" value={value.href} onChange={href => onChange({ ...value, href })} /></div> : null}</Section>;
}

function CardItemsEditor({ items, onChange }: { items: CardBlock["data"]["items"]; onChange: (items: CardBlock["data"]["items"]) => void }) {
  return <Section title="Các mục">{items.map((item, index) => <div className="grid gap-3 rounded bg-slate-50 p-3" key={index}><div className="grid gap-3 md:grid-cols-2"><Field label="Tiêu đề" value={item.title} onChange={title => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, title } : entry))} /><NullableField label="Đường dẫn (ví dụ /lien-he hoặc https://...)" value={item.href} onChange={href => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, href } : entry))} /></div><Field label="Mô tả" multiline value={item.description} onChange={description => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, description } : entry))} /><ListButtons index={index} length={items.length} onMove={direction => onChange(changePosition(items, index, direction))} onDelete={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} /></div>)}<button type="button" onClick={() => onChange([...items, { title: "Mục mới", description: "Mô tả", href: null }])}>Thêm mục</button></Section>;
}

function BlockFields({ block, onChange }: { block: PageBlock; onChange: (block: PageBlock) => void }) {
  switch (block.type) {
    case "hero": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><NullableField label="Mô tả" multiline value={block.data.description} onChange={description => onChange({ ...block, data: { ...block.data, description } })} /><ActionFields title="Nút chính" value={block.data.primaryAction} onChange={primaryAction => onChange({ ...block, data: { ...block.data, primaryAction } })} /><ActionFields title="Nút phụ" value={block.data.secondaryAction} onChange={secondaryAction => onChange({ ...block, data: { ...block.data, secondaryAction } })} /></>;
    case "stats": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><NullableField label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><Section title="Các số liệu">{block.data.items.map((item, index) => <div className="grid gap-3 rounded bg-slate-50 p-3" key={index}><div className="grid gap-3 md:grid-cols-2"><Field label="Giá trị" value={item.value} onChange={value => onChange({ ...block, data: { ...block.data, items: block.data.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, value } : entry) } })} /><Field label="Nhãn" value={item.label} onChange={label => onChange({ ...block, data: { ...block.data, items: block.data.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, label } : entry) } })} /></div><NullableField label="Ghi chú" value={item.note} onChange={note => onChange({ ...block, data: { ...block.data, items: block.data.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, note } : entry) } })} /><ListButtons index={index} length={block.data.items.length} onMove={direction => onChange({ ...block, data: { ...block.data, items: changePosition(block.data.items, index, direction) } })} onDelete={() => onChange({ ...block, data: { ...block.data, items: block.data.items.filter((_, itemIndex) => itemIndex !== index) } })} /></div>)}<button type="button" onClick={() => onChange({ ...block, data: { ...block.data, items: [...block.data.items, { value: "0", label: "Nhãn số liệu", note: null }] } })}>Thêm số liệu</button></Section></>;
    case "features":
    case "industries":
    case "ecosystem":
    case "process": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><NullableField label="Mô tả" multiline value={block.data.description} onChange={description => onChange({ ...block, data: { ...block.data, description } })} /><CardItemsEditor items={block.data.items} onChange={items => onChange({ ...block, data: { ...block.data, items } })} /></>;
    case "testimonials": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><NumberField label="Số lượng hiển thị" value={block.data.limit} max={30} onChange={limit => onChange({ ...block, data: { ...block.data, limit } })} /></>;
    case "partners": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><label className="grid gap-1 text-sm font-medium">Nhóm hiển thị<select className="rounded border p-2 font-normal" value={block.data.kind} onChange={event => onChange({ ...block, data: { ...block.data, kind: event.target.value as typeof block.data.kind } })}><option value="all">Tất cả</option><option value="partner">Đối tác</option><option value="customer">Khách hàng</option></select></label><NumberField label="Số lượng hiển thị" value={block.data.limit} max={60} onChange={limit => onChange({ ...block, data: { ...block.data, limit } })} /></>;
    case "featured_posts": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><NumberField label="Số bài viết hiển thị" value={block.data.limit} max={12} onChange={limit => onChange({ ...block, data: { ...block.data, limit } })} /></>;
    case "faq": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><Section title="Câu hỏi và trả lời">{block.data.items.map((item, index) => <div className="grid gap-3 rounded bg-slate-50 p-3" key={index}><Field label="Câu hỏi" value={item.question} onChange={question => onChange({ ...block, data: { ...block.data, items: block.data.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, question } : entry) } })} /><Field label="Trả lời" multiline value={item.answer} onChange={answer => onChange({ ...block, data: { ...block.data, items: block.data.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, answer } : entry) } })} /><ListButtons index={index} length={block.data.items.length} onMove={direction => onChange({ ...block, data: { ...block.data, items: changePosition(block.data.items, index, direction) } })} onDelete={() => onChange({ ...block, data: { ...block.data, items: block.data.items.filter((_, itemIndex) => itemIndex !== index) } })} /></div>)}<button type="button" onClick={() => onChange({ ...block, data: { ...block.data, items: [...block.data.items, { question: "Câu hỏi mới", answer: "Nội dung trả lời" }] } })}>Thêm câu hỏi</button></Section></>;
    case "cta": return <><NullableField label="Mã neo (tùy chọn)" value={block.data.id} onChange={id => onChange({ ...block, data: { ...block.data, id } })} /><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><ActionFields title="Nút hành động" value={block.data.action} optional={false} onChange={action => action && onChange({ ...block, data: { ...block.data, action } })} /></>;
    case "lead_form": return <><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><NullableField label="Mô tả" multiline value={block.data.description} onChange={description => onChange({ ...block, data: { ...block.data, description } })} /><Field label="Nhãn nút gửi" value={block.data.submitLabel} onChange={submitLabel => onChange({ ...block, data: { ...block.data, submitLabel } })} /><Section title="Nhu cầu để khách hàng chọn">{block.data.needOptions.map((item, index) => <div className="flex gap-2" key={index}><input className="min-w-0 flex-1 rounded border p-2" value={item} onChange={event => onChange({ ...block, data: { ...block.data, needOptions: block.data.needOptions.map((entry, itemIndex) => itemIndex === index ? event.target.value : entry) } })} /><ListButtons index={index} length={block.data.needOptions.length} onMove={direction => onChange({ ...block, data: { ...block.data, needOptions: changePosition(block.data.needOptions, index, direction) } })} onDelete={() => onChange({ ...block, data: { ...block.data, needOptions: block.data.needOptions.filter((_, itemIndex) => itemIndex !== index) } })} /></div>)}<button type="button" onClick={() => onChange({ ...block, data: { ...block.data, needOptions: [...block.data.needOptions, "Nhu cầu mới"] } })}>Thêm nhu cầu</button></Section></>;
    case "rich_text": return <><NullableField label="Tiêu đề (tùy chọn)" value={block.data.heading} onChange={heading => onChange({ ...block, data: { ...block.data, heading } })} /><Field label="Nội dung" multiline value={block.data.body} onChange={body => onChange({ ...block, data: { ...block.data, body } })} /></>;
    case "image": return <><MediaPicker value={block.data.mediaId || null} onChange={mediaId => onChange({ ...block, data: { ...block.data, mediaId: mediaId ?? "" } })} /><NullableField label="Mô tả thay thế" value={block.data.alt} onChange={alt => onChange({ ...block, data: { ...block.data, alt } })} /><NullableField label="Chú thích" multiline value={block.data.caption} onChange={caption => onChange({ ...block, data: { ...block.data, caption } })} /></>;
    case "download_list": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /></>;
  }
}

export function PageBlocksEditor({ blocks, onChange }: { blocks: PageBlock[]; onChange: (blocks: PageBlock[]) => void }) {
  function update(index: number, block: PageBlock) { onChange(blocks.map((item, itemIndex) => itemIndex === index ? block : item)); }
  return <section className="grid gap-4"><div><h3 className="text-lg font-bold">Thành phần trang</h3><p className="text-sm text-slate-600">Thêm, chỉnh sửa, bật/tắt hoặc đổi thứ tự từng thành phần. Không cần sửa JSON.</p></div>{blocks.map((block, index) => <article className="grid gap-4 rounded border p-4" key={`${block.type}-${index}`}><div className="flex flex-wrap items-center justify-between gap-3"><label className="font-semibold">Thành phần {index + 1}<select className="ml-2 rounded border p-2 font-normal" value={block.type} onChange={event => { const replacement = newBlock(event.target.value as BlockType); replacement.isEnabled = block.isEnabled; update(index, replacement); }}>{blockOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><div className="flex items-center gap-2"><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={block.isEnabled} onChange={event => update(index, { ...block, isEnabled: event.target.checked })} />Hiển thị</label><ListButtons index={index} length={blocks.length} onMove={direction => onChange(changePosition(blocks, index, direction))} onDelete={() => onChange(blocks.filter((_, itemIndex) => itemIndex !== index))} /></div></div><BlockFields block={block} onChange={next => update(index, next)} /></article>)}<label className="grid gap-1 font-medium">Thêm thành phần<select className="rounded border p-2" defaultValue="" onChange={event => { if (event.target.value) { onChange([...blocks, newBlock(event.target.value as BlockType)]); event.target.value = ""; } }}><option value="" disabled>Chọn loại thành phần</option>{blockOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label></section>;
}
