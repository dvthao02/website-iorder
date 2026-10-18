"use client";

import { ArrowDown, ArrowUp, ChevronRight, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { collectionSources, type CollectionSource, type PageBlock } from "@iorder/core/server/pages/pages.contract";

import { MediaPicker } from "./media-picker";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminStatusBadge } from "./ui/admin-feedback";

type BlockType = PageBlock["type"];
type CardBlock = Extract<PageBlock, { type: "features" | "industries" | "ecosystem" | "process" }>;
type Action = { label: string; href: string };

// `legacy`: loại cũ vẫn sửa được trên trang đã lưu, nhưng không cho thêm mới (dùng "Danh sách nội dung").
const blockOptions: ReadonlyArray<{ value: BlockType; label: string; description: string; legacy?: boolean }> = [
  { value: "hero", label: "Phần đầu trang", description: "Tiêu đề lớn, mô tả ngắn và tối đa hai nút." },
  { value: "collection_list", label: "Danh sách nội dung", description: "Bài viết, sản phẩm, thiết bị… tự cập nhật khi có nội dung mới." },
  { value: "rich_text", label: "Đoạn văn bản", description: "Tiêu đề và nội dung chữ tự do." },
  { value: "image", label: "Hình ảnh", description: "Một ảnh từ thư viện media, kèm chú thích." },
  { value: "stats", label: "Số liệu nổi bật", description: "Các con số kèm nhãn ngắn." },
  { value: "features", label: "Tính năng", description: "Lưới thẻ: tiêu đề, mô tả, liên kết." },
  { value: "industries", label: "Lĩnh vực áp dụng", description: "Lưới thẻ giới thiệu các mô hình kinh doanh phù hợp." },
  { value: "ecosystem", label: "Hệ sinh thái", description: "Lưới thẻ giới thiệu các sản phẩm liên quan." },
  { value: "process", label: "Quy trình", description: "Các bước thực hiện theo thứ tự." },
  { value: "testimonials", label: "Cảm nhận khách hàng", description: "Lấy từ mục Đối tác & Đánh giá." },
  { value: "partners", label: "Logo đối tác, khách hàng", description: "Lấy từ mục Đối tác & Đánh giá." },
  { value: "faq", label: "Câu hỏi thường gặp", description: "Danh sách câu hỏi và trả lời." },
  { value: "cta", label: "Kêu gọi hành động", description: "Một dòng tiêu đề và một nút." },
  { value: "lead_form", label: "Biểu mẫu nhận tư vấn", description: "Form gửi liên hệ về mục Khách hàng tiềm năng." },
  { value: "featured_posts", label: "Bài viết nổi bật (cũ)", description: "", legacy: true },
  { value: "download_list", label: "Danh sách tải về (cũ)", description: "", legacy: true },
];

// Trang danh sách (tin tức, thiết bị…) chỉ cần khối phục vụ việc đọc danh sách; khối giới thiệu kiểu trang chủ để ở trang thường.
const listingBlockTypes: ReadonlySet<BlockType> = new Set(["collection_list", "rich_text", "image", "stats", "faq", "cta", "lead_form", "testimonials", "partners"]);

function blockLabel(type: BlockType) {
  return blockOptions.find((option) => option.value === type)?.label ?? type;
}

// Dòng tóm tắt khi khối đang gập, để nhìn được cả trang mà không mở từng khối.
function blockSummary(block: PageBlock) {
  switch (block.type) {
    case "hero": return block.data.title;
    case "stats": return block.data.title ?? `${block.data.items.length} số liệu`;
    case "rich_text": return block.data.heading ?? block.data.body.slice(0, 80);
    case "image": return block.data.alt ?? block.data.caption ?? (block.data.mediaId ? "Đã chọn ảnh" : "Chưa chọn ảnh");
    case "collection_list": return [collectionSources.find((source) => source.value === block.data.source)?.label, block.data.title].filter(Boolean).join(" · ");
    case "lead_form": return block.data.title;
    case "cta": return block.data.title;
    default: return "title" in block.data ? block.data.title ?? "" : "";
  }
}

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
    case "collection_list": return { type, isEnabled: true, data: { source: "posts", eyebrow: null, title: "Bài viết mới nhất", description: null, limit: 6, anchor: null } };
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
  return <label className="admin-field">{label}{multiline ? <textarea className="min-h-24" value={value} onChange={event => onChange(event.target.value)} /> : <input type={type} min={min} value={value} onChange={event => onChange(event.target.value)} />}</label>;
}

function NullableField({ label, value, onChange, multiline = false, type = "text" }: { label: string; value: string | null; onChange: (value: string | null) => void; multiline?: boolean; type?: "text" | "url" }) {
  return <Field label={label} value={value ?? ""} multiline={multiline} type={type} onChange={next => onChange(next === "" ? null : next)} />;
}

function NumberField({ label, value, onChange, max }: { label: string; value: number; onChange: (value: number) => void; max?: number }) {
  return <Field label={label} type="number" min={1} value={String(value)} onChange={next => onChange(Math.max(1, Math.min(max ?? Number.MAX_SAFE_INTEGER, Number(next) || 1)))} />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="grid gap-3 rounded-[var(--cms-radius-component)] border border-[var(--cms-border)] bg-[var(--cms-subtle)] p-3"><legend>{title}</legend>{children}</fieldset>;
}

function ListButtons({ index, length, onMove, onDelete }: { index: number; length: number; onMove: (direction: -1 | 1) => void; onDelete: () => void }) {
  return <div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => onMove(-1)}>Lên</button><button type="button" disabled={index === length - 1} onClick={() => onMove(1)}>Xuống</button><button type="button" className="admin-button admin-button--danger admin-button--sm" onClick={onDelete}>Xóa</button></div>;
}

function ActionFields({ title, value, onChange, optional = true }: { title: string; value: Action | null; onChange: (value: Action | null) => void; optional?: boolean }) {
  const active = value !== null;
  return <Section title={title}>{optional ? <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={event => onChange(event.target.checked ? { label: "Xem thêm", href: "/lien-he" } : null)} />Hiển thị nút này</label> : null}{active ? <div className="admin-form-grid"><Field label="Nhãn nút" value={value.label} onChange={label => onChange({ ...value, label })} /><Field label="Đường dẫn (ví dụ /lien-he hoặc https://...)" value={value.href} onChange={href => onChange({ ...value, href })} /></div> : null}</Section>;
}

function CardItemsEditor({ items, onChange }: { items: CardBlock["data"]["items"]; onChange: (items: CardBlock["data"]["items"]) => void }) {
  return <Section title="Các mục">{items.map((item, index) => <div className="grid gap-3 rounded-[var(--cms-radius-component)] border border-[var(--cms-border)] bg-[var(--cms-subtle)] p-3" key={index}><div className="admin-form-grid"><Field label="Tiêu đề" value={item.title} onChange={title => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, title } : entry))} /><NullableField label="Đường dẫn (ví dụ /lien-he hoặc https://...)" value={item.href} onChange={href => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, href } : entry))} /></div><Field label="Mô tả" multiline value={item.description} onChange={description => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, description } : entry))} /><ListButtons index={index} length={items.length} onMove={direction => onChange(changePosition(items, index, direction))} onDelete={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} /></div>)}<button type="button" onClick={() => onChange([...items, { title: "Mục mới", description: "Mô tả", href: null }])}>Thêm mục</button></Section>;
}

function BlockFields({ block, onChange, disabled, onUploadingChange }: { block: PageBlock; onChange: (block: PageBlock) => void; disabled?: boolean; onUploadingChange: (pending: boolean) => void }) {
  switch (block.type) {
    case "hero": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><NullableField label="Mô tả" multiline value={block.data.description} onChange={description => onChange({ ...block, data: { ...block.data, description } })} /><ActionFields title="Nút chính" value={block.data.primaryAction} onChange={primaryAction => onChange({ ...block, data: { ...block.data, primaryAction } })} /><ActionFields title="Nút phụ" value={block.data.secondaryAction} onChange={secondaryAction => onChange({ ...block, data: { ...block.data, secondaryAction } })} /></>;
    case "stats": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><NullableField label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><Section title="Các số liệu">{block.data.items.map((item, index) => <div className="grid gap-3 rounded-[var(--cms-radius-component)] border border-[var(--cms-border)] bg-[var(--cms-subtle)] p-3" key={index}><div className="admin-form-grid"><Field label="Giá trị" value={item.value} onChange={value => onChange({ ...block, data: { ...block.data, items: block.data.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, value } : entry) } })} /><Field label="Nhãn" value={item.label} onChange={label => onChange({ ...block, data: { ...block.data, items: block.data.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, label } : entry) } })} /></div><NullableField label="Ghi chú" value={item.note} onChange={note => onChange({ ...block, data: { ...block.data, items: block.data.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, note } : entry) } })} /><ListButtons index={index} length={block.data.items.length} onMove={direction => onChange({ ...block, data: { ...block.data, items: changePosition(block.data.items, index, direction) } })} onDelete={() => onChange({ ...block, data: { ...block.data, items: block.data.items.filter((_, itemIndex) => itemIndex !== index) } })} /></div>)}<button type="button" onClick={() => onChange({ ...block, data: { ...block.data, items: [...block.data.items, { value: "0", label: "Nhãn số liệu", note: null }] } })}>Thêm số liệu</button></Section></>;
    case "features":
    case "industries":
    case "ecosystem":
    case "process": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><NullableField label="Mô tả" multiline value={block.data.description} onChange={description => onChange({ ...block, data: { ...block.data, description } })} /><CardItemsEditor items={block.data.items} onChange={items => onChange({ ...block, data: { ...block.data, items } })} /></>;
    case "testimonials": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><NumberField label="Số lượng hiển thị" value={block.data.limit} max={30} onChange={limit => onChange({ ...block, data: { ...block.data, limit } })} /></>;
    case "partners": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><label className="admin-field">Nhóm hiển thị<select value={block.data.kind} onChange={event => onChange({ ...block, data: { ...block.data, kind: event.target.value as typeof block.data.kind } })}><option value="all">Tất cả</option><option value="partner">Đối tác</option><option value="customer">Khách hàng</option></select></label><NumberField label="Số lượng hiển thị" value={block.data.limit} max={60} onChange={limit => onChange({ ...block, data: { ...block.data, limit } })} /></>;
    case "featured_posts": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><NumberField label="Số bài viết hiển thị" value={block.data.limit} max={12} onChange={limit => onChange({ ...block, data: { ...block.data, limit } })} /></>;
    case "faq": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><Section title="Câu hỏi và trả lời">{block.data.items.map((item, index) => <div className="grid gap-3 rounded-[var(--cms-radius-component)] border border-[var(--cms-border)] bg-[var(--cms-subtle)] p-3" key={index}><Field label="Câu hỏi" value={item.question} onChange={question => onChange({ ...block, data: { ...block.data, items: block.data.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, question } : entry) } })} /><Field label="Trả lời" multiline value={item.answer} onChange={answer => onChange({ ...block, data: { ...block.data, items: block.data.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, answer } : entry) } })} /><ListButtons index={index} length={block.data.items.length} onMove={direction => onChange({ ...block, data: { ...block.data, items: changePosition(block.data.items, index, direction) } })} onDelete={() => onChange({ ...block, data: { ...block.data, items: block.data.items.filter((_, itemIndex) => itemIndex !== index) } })} /></div>)}<button type="button" onClick={() => onChange({ ...block, data: { ...block.data, items: [...block.data.items, { question: "Câu hỏi mới", answer: "Nội dung trả lời" }] } })}>Thêm câu hỏi</button></Section></>;
    case "cta": return <><NullableField label="Mã neo (tùy chọn)" value={block.data.id} onChange={id => onChange({ ...block, data: { ...block.data, id } })} /><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><ActionFields title="Nút hành động" value={block.data.action} optional={false} onChange={action => action && onChange({ ...block, data: { ...block.data, action } })} /></>;
    case "lead_form": return <><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><NullableField label="Mô tả" multiline value={block.data.description} onChange={description => onChange({ ...block, data: { ...block.data, description } })} /><Field label="Nhãn nút gửi" value={block.data.submitLabel} onChange={submitLabel => onChange({ ...block, data: { ...block.data, submitLabel } })} /><Section title="Nhu cầu để khách hàng chọn">{block.data.needOptions.map((item, index) => <div className="flex gap-2" key={index}><input className="min-w-0 flex-1" value={item} onChange={event => onChange({ ...block, data: { ...block.data, needOptions: block.data.needOptions.map((entry, itemIndex) => itemIndex === index ? event.target.value : entry) } })} /><ListButtons index={index} length={block.data.needOptions.length} onMove={direction => onChange({ ...block, data: { ...block.data, needOptions: changePosition(block.data.needOptions, index, direction) } })} onDelete={() => onChange({ ...block, data: { ...block.data, needOptions: block.data.needOptions.filter((_, itemIndex) => itemIndex !== index) } })} /></div>)}<button type="button" onClick={() => onChange({ ...block, data: { ...block.data, needOptions: [...block.data.needOptions, "Nhu cầu mới"] } })}>Thêm nhu cầu</button></Section></>;
    case "rich_text": return <><NullableField label="Tiêu đề (tùy chọn)" value={block.data.heading} onChange={heading => onChange({ ...block, data: { ...block.data, heading } })} /><Field label="Nội dung" multiline value={block.data.body} onChange={body => onChange({ ...block, data: { ...block.data, body } })} /></>;
    case "image": return <><MediaPicker disabled={disabled} onUploadingChange={onUploadingChange} value={block.data.mediaId || null} onChange={mediaId => onChange({ ...block, data: { ...block.data, mediaId: mediaId ?? "" } })} /><NullableField label="Mô tả thay thế" value={block.data.alt} onChange={alt => onChange({ ...block, data: { ...block.data, alt } })} /><NullableField label="Chú thích" multiline value={block.data.caption} onChange={caption => onChange({ ...block, data: { ...block.data, caption } })} /></>;
    case "collection_list": return <>
      <label className="admin-field">Nguồn nội dung<select value={block.data.source} onChange={event => onChange({ ...block, data: { ...block.data, source: event.target.value as CollectionSource } })}>{collectionSources.map(source => <option key={source.value} value={source.value}>{source.label}</option>)}</select></label>
      <NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} />
      <NullableField label="Tiêu đề (để trống khi danh sách nằm ngay dưới phần đầu trang)" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} />
      <NullableField label="Mô tả" multiline value={block.data.description} onChange={description => onChange({ ...block, data: { ...block.data, description } })} />
      <Field label="Số mục tối đa (để trống: hiển thị tất cả)" min={1} type="number" value={block.data.limit === null ? "" : String(block.data.limit)} onChange={next => onChange({ ...block, data: { ...block.data, limit: next === "" ? null : Math.max(1, Math.min(100, Number(next) || 1)) } })} />
      <NullableField label="Mã neo (tùy chọn, ví dụ huong-dan để liên kết tới #huong-dan)" value={block.data.anchor} onChange={anchor => onChange({ ...block, data: { ...block.data, anchor: anchor === null ? null : anchor.trim().toLowerCase() } })} />
    </>;
    case "download_list": return <><NullableField label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /></>;
  }
}

type PageBlocksEditorProps = {
  blocks: PageBlock[];
  onChange: (blocks: PageBlock[]) => void;
  disabled?: boolean;
  onUploadingChange?: (pending: boolean) => void;
  /** Trang danh sách: phần đầu trang cố định ở vị trí đầu, chỉ thêm được khối phục vụ danh sách. */
  listing?: boolean;
};

export function PageBlocksEditor({ blocks, onChange, disabled, onUploadingChange, listing = false }: PageBlocksEditorProps) {
  const uploads = useRef(new Set<number>());
  const { confirm } = useAdminConfirm();
  const addMenu = useRef<HTMLDetailsElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(blocks.length ? 0 : null);
  const pinnedHero = listing && blocks[0]?.type === "hero";
  const hasHero = blocks.some((block) => block.type === "hero");
  const addable = blockOptions.filter((option) => !option.legacy && (option.value === "hero" ? !hasHero : !listing || listingBlockTypes.has(option.value)));

  function reportUploading(index: number, pending: boolean) {
    if (pending) uploads.current.add(index);
    else uploads.current.delete(index);
    onUploadingChange?.(uploads.current.size > 0);
  }
  function update(index: number, block: PageBlock) { onChange(blocks.map((item, itemIndex) => itemIndex === index ? block : item)); }
  function move(index: number, direction: -1 | 1) {
    if (uploads.current.size) return;
    const target = index + direction;
    onChange(changePosition(blocks, index, direction));
    setOpenIndex((current) => current === index ? target : current === target ? index : current);
  }
  async function remove(index: number) {
    if (uploads.current.size) return;
    if (!await confirm({ title: "Xóa thành phần", message: `Xóa “${blockLabel(blocks[index].type)}” khỏi trang? Nội dung của thành phần này sẽ mất khi lưu.`, confirmLabel: "Xóa", tone: "danger" })) return;
    onChange(blocks.filter((_, itemIndex) => itemIndex !== index));
    setOpenIndex((current) => current === null || current === index ? null : current > index ? current - 1 : current);
  }
  function add(type: BlockType) {
    if (uploads.current.size) return;
    const next = type === "hero" ? [newBlock(type), ...blocks] : [...blocks, newBlock(type)];
    onChange(next);
    setOpenIndex(type === "hero" ? 0 : next.length - 1);
    if (addMenu.current) addMenu.current.open = false;
  }

  return <section className="admin-blocks">
    <ol className="admin-blocks__list">
      {blocks.map((block, index) => {
        const pinned = pinnedHero && index === 0;
        const open = openIndex === index;
        const lockedAbove = pinnedHero && index === 1;
        return <li className={open ? "admin-block admin-block--open" : "admin-block"} key={`${block.type}-${index}`}>
          <div className="admin-block__head">
            <button aria-expanded={open} className="admin-block__toggle" onClick={() => setOpenIndex(open ? null : index)} type="button">
              <ChevronRight aria-hidden="true" className="admin-block__chevron" size={16} />
              <span className="admin-block__index">{index + 1}</span>
              <strong>{blockLabel(block.type)}</strong>
              <span className="admin-block__summary">{blockSummary(block)}</span>
              {pinned ? <small>Cố định đầu trang</small> : null}
              {!block.isEnabled ? <AdminStatusBadge>Đang ẩn</AdminStatusBadge> : null}
            </button>
            <div className="admin-block__actions">
              <button aria-label={`Đưa ${blockLabel(block.type)} lên`} className="admin-content-actions__button" disabled={disabled || pinned || index === 0 || lockedAbove} onClick={() => move(index, -1)} title="Đưa lên" type="button"><ArrowUp aria-hidden="true" /></button>
              <button aria-label={`Đưa ${blockLabel(block.type)} xuống`} className="admin-content-actions__button" disabled={disabled || pinned || index === blocks.length - 1} onClick={() => move(index, 1)} title="Đưa xuống" type="button"><ArrowDown aria-hidden="true" /></button>
              <button aria-label={block.isEnabled ? `Ẩn ${blockLabel(block.type)}` : `Hiện ${blockLabel(block.type)}`} aria-pressed={!block.isEnabled} className="admin-content-actions__button" disabled={disabled || pinned} onClick={() => update(index, { ...block, isEnabled: !block.isEnabled })} title={block.isEnabled ? "Ẩn khỏi website" : "Hiện trên website"} type="button">{block.isEnabled ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</button>
              <button aria-label={`Xóa ${blockLabel(block.type)}`} className="admin-content-actions__button admin-content-actions__delete" disabled={disabled || pinned} onClick={() => void remove(index)} title="Xóa thành phần" type="button"><Trash2 aria-hidden="true" /></button>
            </div>
          </div>
          {open ? <div className="admin-block__body"><BlockFields block={block} disabled={disabled} onUploadingChange={pending => reportUploading(index, pending)} onChange={next => update(index, next)} /></div> : null}
        </li>;
      })}
    </ol>
    {blocks.length === 0 ? <p className="admin-help">Trang chưa có thành phần nào.</p> : null}
    <details className="admin-block-add" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} ref={addMenu}>
      <summary className="admin-button admin-button--secondary admin-button--sm"><Plus aria-hidden="true" />Thêm thành phần</summary>
      <div className="admin-block-add__menu" role="menu">
        {addable.map((option) => <button className="admin-block-add__item" disabled={disabled} key={option.value} onClick={() => add(option.value)} role="menuitem" type="button"><strong>{option.label}</strong><small>{option.description}</small></button>)}
      </div>
    </details>
  </section>;
}
