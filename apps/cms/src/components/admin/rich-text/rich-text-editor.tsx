"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold, Columns3, FileUp, Heading2, Heading3, Heading4, ImagePlus, Italic, LayoutTemplate, Link2, List, ListOrdered,
  Minus, Pilcrow, Quote, Redo2, RemoveFormatting, Rows3, Strikethrough, Table as TableIcon,
  Trash2, Underline, Undo2, Unlink, Wallpaper,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import type { BannerHeight, BannerOverlay, ImageAlign, RichDocument } from "@iorder/core/server/shared/rich-text";
import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { useAdminConfirm } from "../ui/admin-confirm-dialog";
import { useAdminToast } from "../ui/admin-feedback";
import { ImageBanner, SizedImage } from "./extensions";
import { imageWraps } from "./image-view";
import { importAccept, importFile } from "./import-content";
import { contentTemplates } from "./templates";

async function uploadImage(file: File) {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch("/api/admin/media", { method: "POST", body });
  const payload = await readAdminJson(response);
  const url = payload?.asset?.url;
  if (!response.ok || typeof url !== "string") throw adminApiError(payload, "Không tải được ảnh lên.");
  return url;
}

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <button aria-label={label} aria-pressed={active} className={active ? "admin-rte__tool admin-rte__tool--active" : "admin-rte__tool"} disabled={disabled} onClick={onClick} onMouseDown={(event) => event.preventDefault()} title={label} type="button">{children}</button>;
}

const widthOptions = [25, 33, 50, 75, 100].map((value) => ({ value: String(value), label: value === 100 ? "Toàn khổ" : `${value}%` }));
const overlayOptions: { value: BannerOverlay; label: string }[] = [{ value: "dark", label: "Tối" }, { value: "light", label: "Sáng" }, { value: "none", label: "Không" }];
const heightOptions: { value: BannerHeight; label: string }[] = [{ value: "short", label: "Thấp" }, { value: "medium", label: "Vừa" }, { value: "tall", label: "Cao" }];

function Segmented<T extends string>({ label, value, options, disabled, onChange }: { label: string; value: T; options: { value: T; label: string }[]; disabled?: boolean; onChange: (value: T) => void }) {
  return <div aria-label={label} className="admin-rte__segmented" role="group">
    <span>{label}</span>
    {options.map((option) => <button aria-pressed={value === option.value} className={value === option.value ? "admin-rte__seg admin-rte__seg--active" : "admin-rte__seg"} disabled={disabled} key={option.value} onClick={() => onChange(option.value)} onMouseDown={(event) => event.preventDefault()} type="button">{option.label}</button>)}
  </div>;
}

function isEmptyDoc(editor: Editor) {
  return editor.isEmpty || !editor.getText().trim();
}

type RichTextEditorProps = {
  value: RichDocument | null;
  onChange: (doc: RichDocument) => void;
  /** Tiêu đề H1 lấy từ file nhập (để điền vào tiêu đề bài nếu còn trống). */
  onImportTitle?: (title: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showTemplates?: boolean;
};

/** Trình soạn thảo kiểu Word: tiêu đề, định dạng chữ, danh sách, trích dẫn, liên kết, ảnh, bảng, mẫu bài, nhập file. */
export function RichTextEditor({ value, onChange, onImportTitle, placeholder = "Bắt đầu viết nội dung…", disabled, showTemplates = true }: RichTextEditorProps) {
  const { show } = useAdminToast();
  const { confirm } = useAdminConfirm();
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const templateMenu = useRef<HTMLDetailsElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    // Thanh công cụ đọc trạng thái trực tiếp từ editor nên cần dựng lại khi con trỏ/định dạng đổi.
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer", target: null } },
      }),
      SizedImage,
      ImageBanner,
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as RichDocument),
  });

  if (!editor) return <div aria-busy="true" className="admin-rte admin-rte--loading">Đang tải trình soạn thảo…</div>;
  const state = {
    paragraph: editor.isActive("paragraph"),
    h2: editor.isActive("heading", { level: 2 }), h3: editor.isActive("heading", { level: 3 }), h4: editor.isActive("heading", { level: 4 }),
    bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"), strike: editor.isActive("strike"),
    bullet: editor.isActive("bulletList"), ordered: editor.isActive("orderedList"), quote: editor.isActive("blockquote"),
    link: editor.isActive("link"), table: editor.isActive("table"),
    image: editor.isActive("image"), banner: editor.isActive("imageBanner"),
    canUndo: editor.can().undo(), canRedo: editor.can().redo(),
    words: editor.getText().split(/\s+/).filter(Boolean).length,
  };
  const chain = () => editor.chain().focus();
  const imageAttrs = state.image ? editor.getAttributes("image") as { alt: string | null; title: string | null; width: number; align: ImageAlign } : null;
  const bannerAttrs = state.banner ? editor.getAttributes("imageBanner") as { overlay: BannerOverlay; height: BannerHeight } : null;
  // Ô nhập mô tả/chú thích giữ focus, nên cập nhật thuộc tính ảnh mà không kéo focus về editor.
  const setImageAttrs = (attrs: Record<string, unknown>, focus = true) => (focus ? chain() : editor.chain()).updateAttributes("image", attrs).run();
  const setBannerAttrs = (attrs: Record<string, unknown>) => chain().updateAttributes("imageBanner", attrs).run();
  const locked = disabled || busy !== null;

  function applyLink() {
    if (!editor || linkDraft === null) return;
    const href = linkDraft.trim();
    if (!href) chain().extendMarkRange("link").unsetLink().run();
    else if (!/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href)) { show("Liên kết phải bắt đầu bằng https://, mailto:, tel: hoặc / (trang trong website).", "warning"); return; }
    else chain().extendMarkRange("link").setLink({ href }).run();
    setLinkDraft(null);
  }

  async function insertImage(file: File | undefined) {
    if (!editor || !file) return;
    setBusy("Đang tải ảnh…");
    try {
      const src = await uploadImage(file);
      chain().setImage({ src, alt: file.name.replace(/\.[^.]+$/, "") }).run();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không tải được ảnh lên.", "error");
    } finally {
      setBusy(null);
      if (imageInput.current) imageInput.current.value = "";
    }
  }

  // Chèn khối ảnh nền mới, hoặc đổi ảnh của khối đang chọn.
  async function insertBanner(file: File | undefined) {
    if (!editor || !file) return;
    setBusy("Đang tải ảnh nền…");
    try {
      const src = await uploadImage(file);
      if (editor.isActive("imageBanner")) chain().updateAttributes("imageBanner", { src }).run();
      else chain().insertContent({ type: "imageBanner", attrs: { src }, content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Tiêu đề trên ảnh" }] },
        { type: "paragraph", content: [{ type: "text", text: "Một câu giới thiệu ngắn hiển thị trên nền ảnh." }] },
      ] }).run();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không tải được ảnh lên.", "error");
    } finally {
      setBusy(null);
      if (bannerInput.current) bannerInput.current.value = "";
    }
  }

  async function importFromFile(file: File | undefined) {
    if (!editor || !file) return;
    if (!isEmptyDoc(editor) && !(await confirm({ title: "Nhập nội dung từ file", message: `Thay toàn bộ nội dung hiện tại bằng nội dung trong “${file.name}”? Có thể bấm Hoàn tác (Ctrl+Z) nếu đổi ý.`, confirmLabel: "Thay nội dung" }))) {
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setBusy("Đang đọc file…");
    try {
      const result = await importFile(file, uploadImage);
      if (!result.html.replace(/<[^>]+>/g, "").trim() && !/<img/i.test(result.html)) throw new Error("File không có nội dung đọc được.");
      editor.chain().focus().setContent(result.html, { emitUpdate: true }).run();
      if (result.title) onImportTitle?.(result.title);
      show(["Đã nhập nội dung từ file.", ...result.warnings].join(" "), result.warnings.some((warning) => warning.startsWith("Bỏ")) ? "warning" : "success");
    } catch (error) {
      show(error instanceof Error ? error.message : "Không đọc được file.", "error");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function insertTemplate(id: string) {
    if (templateMenu.current) templateMenu.current.open = false;
    const template = contentTemplates.find((item) => item.id === id);
    if (!editor || !template) return;
    if (isEmptyDoc(editor)) editor.chain().focus().setContent(template.html, { emitUpdate: true }).run();
    else chain().insertContent(template.html).run();
  }

  return <div className={disabled ? "admin-rte admin-rte--disabled" : "admin-rte"}>
    <div aria-label="Định dạng nội dung" className="admin-rte__toolbar" role="toolbar">
      <ToolButton disabled={locked || !state.canUndo} label="Hoàn tác (Ctrl+Z)" onClick={() => chain().undo().run()}><Undo2 size={16} /></ToolButton>
      <ToolButton disabled={locked || !state.canRedo} label="Làm lại (Ctrl+Y)" onClick={() => chain().redo().run()}><Redo2 size={16} /></ToolButton>
      <span className="admin-rte__divider" />
      <ToolButton active={state.paragraph} disabled={locked} label="Đoạn văn" onClick={() => chain().setParagraph().run()}><Pilcrow size={16} /></ToolButton>
      <ToolButton active={state.h2} disabled={locked} label="Tiêu đề lớn (H2) — hiện trong mục lục" onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></ToolButton>
      <ToolButton active={state.h3} disabled={locked} label="Tiêu đề nhỏ (H3) — hiện trong mục lục" onClick={() => chain().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></ToolButton>
      <ToolButton active={state.h4} disabled={locked} label="Tiêu đề phụ (H4)" onClick={() => chain().toggleHeading({ level: 4 }).run()}><Heading4 size={16} /></ToolButton>
      <span className="admin-rte__divider" />
      <ToolButton active={state.bold} disabled={locked} label="In đậm (Ctrl+B)" onClick={() => chain().toggleBold().run()}><Bold size={16} /></ToolButton>
      <ToolButton active={state.italic} disabled={locked} label="In nghiêng (Ctrl+I)" onClick={() => chain().toggleItalic().run()}><Italic size={16} /></ToolButton>
      <ToolButton active={state.underline} disabled={locked} label="Gạch chân (Ctrl+U)" onClick={() => chain().toggleUnderline().run()}><Underline size={16} /></ToolButton>
      <ToolButton active={state.strike} disabled={locked} label="Gạch ngang" onClick={() => chain().toggleStrike().run()}><Strikethrough size={16} /></ToolButton>
      <ToolButton active={state.link} disabled={locked} label="Chèn liên kết" onClick={() => setLinkDraft(editor.getAttributes("link").href ?? "https://")}><Link2 size={16} /></ToolButton>
      {state.link ? <ToolButton disabled={locked} label="Bỏ liên kết" onClick={() => chain().extendMarkRange("link").unsetLink().run()}><Unlink size={16} /></ToolButton> : null}
      <ToolButton disabled={locked} label="Xóa định dạng" onClick={() => chain().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={16} /></ToolButton>
      <span className="admin-rte__divider" />
      <ToolButton active={state.bullet} disabled={locked} label="Danh sách chấm" onClick={() => chain().toggleBulletList().run()}><List size={16} /></ToolButton>
      <ToolButton active={state.ordered} disabled={locked} label="Danh sách số" onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={16} /></ToolButton>
      <ToolButton active={state.quote} disabled={locked} label="Trích dẫn" onClick={() => chain().toggleBlockquote().run()}><Quote size={16} /></ToolButton>
      <ToolButton disabled={locked} label="Đường kẻ ngang" onClick={() => chain().setHorizontalRule().run()}><Minus size={16} /></ToolButton>
      <ToolButton disabled={locked} label="Chèn ảnh (tải lên Thư viện media)" onClick={() => imageInput.current?.click()}><ImagePlus size={16} /></ToolButton>
      <ToolButton active={state.banner} disabled={locked} label="Khối ảnh nền (chữ đè lên ảnh)" onClick={() => bannerInput.current?.click()}><Wallpaper size={16} /></ToolButton>
      <ToolButton active={state.table} disabled={locked} label="Chèn bảng 3×3" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={16} /></ToolButton>
      {state.table ? <>
        <ToolButton disabled={locked} label="Thêm hàng bên dưới" onClick={() => chain().addRowAfter().run()}><Rows3 size={16} /></ToolButton>
        <ToolButton disabled={locked} label="Thêm cột bên phải" onClick={() => chain().addColumnAfter().run()}><Columns3 size={16} /></ToolButton>
        <ToolButton disabled={locked} label="Xóa hàng đang chọn" onClick={() => chain().deleteRow().run()}><Rows3 className="admin-rte__danger" size={16} /></ToolButton>
        <ToolButton disabled={locked} label="Xóa bảng" onClick={() => chain().deleteTable().run()}><Trash2 className="admin-rte__danger" size={16} /></ToolButton>
      </> : null}
      <span className="admin-rte__spacer" />
      {showTemplates ? <details className="admin-rte__menu" ref={templateMenu}>
        <summary className="admin-rte__tool admin-rte__tool--text" title="Chèn khung bài mẫu"><LayoutTemplate size={16} />Mẫu bài</summary>
        <div className="admin-rte__menu-list" role="menu">{contentTemplates.map((template) => <button className="admin-rte__menu-item" disabled={locked} key={template.id} onClick={() => void insertTemplate(template.id)} role="menuitem" type="button"><strong>{template.label}</strong><small>{template.description}</small></button>)}</div>
      </details> : null}
      <ToolButton disabled={locked} label="Nhập từ file Word (.docx), Markdown (.md) hoặc HTML" onClick={() => fileInput.current?.click()}><FileUp size={16} /><span>Nhập file</span></ToolButton>
    </div>
    {linkDraft !== null ? <div className="admin-rte__linkbar">
      <input aria-label="Địa chỉ liên kết" autoFocus onChange={(event) => setLinkDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } if (event.key === "Escape") setLinkDraft(null); }} placeholder="https://… hoặc /trang-trong-website" value={linkDraft} />
      <button className="admin-button admin-button--primary admin-button--sm" onClick={applyLink} type="button">Áp dụng</button>
      <button className="admin-button admin-button--ghost admin-button--sm" onClick={() => setLinkDraft(null)} type="button">Hủy</button>
    </div> : null}
    {imageAttrs ? <div aria-label="Tùy chỉnh ảnh" className="admin-rte__contextbar" role="group">
      <Segmented disabled={locked} label={`Rộng ${imageAttrs.width ?? 100}%`} onChange={(value) => setImageAttrs({ width: Number(value), ...(value === "100" ? { align: "center" } : {}) })} options={widthOptions} value={String(imageAttrs.width ?? 100)} />
      <div aria-label="Ngắt dòng" className="admin-rte__segmented" role="group">
        <span>Ngắt dòng</span>
        {imageWraps.map(({ value, label, Icon }) => <ToolButton active={(imageAttrs.width >= 100 ? "center" : imageAttrs.align) === value} disabled={locked} key={value} label={label} onClick={() => setImageAttrs({ align: value, ...(value !== "center" && imageAttrs.width >= 100 ? { width: 50 } : {}) })}><Icon size={16} /></ToolButton>)}
      </div>
      <label className="admin-rte__field">Mô tả ảnh<input disabled={locked} maxLength={500} onChange={(event) => setImageAttrs({ alt: event.target.value }, false)} placeholder="Cho Google và người khiếm thị" value={imageAttrs.alt ?? ""} /></label>
      <label className="admin-rte__field">Chú thích<input disabled={locked} maxLength={500} onChange={(event) => setImageAttrs({ title: event.target.value }, false)} placeholder="Hiện dưới ảnh (không bắt buộc)" value={imageAttrs.title ?? ""} /></label>
    </div> : null}
    {bannerAttrs ? <div aria-label="Tùy chỉnh khối ảnh nền" className="admin-rte__contextbar" role="group">
      <Segmented disabled={locked} label="Lớp phủ" onChange={(overlay) => setBannerAttrs({ overlay })} options={overlayOptions} value={bannerAttrs.overlay ?? "dark"} />
      <Segmented disabled={locked} label="Chiều cao" onChange={(height) => setBannerAttrs({ height })} options={heightOptions} value={bannerAttrs.height ?? "medium"} />
      <button className="admin-button admin-button--ghost admin-button--sm" disabled={locked} onClick={() => bannerInput.current?.click()} type="button"><Wallpaper size={14} />Đổi ảnh nền</button>
      <button className="admin-button admin-button--ghost admin-button--sm admin-rte__danger" disabled={locked} onClick={() => chain().deleteNode("imageBanner").run()} type="button"><Trash2 size={14} />Xóa khối</button>
    </div> : null}
    <EditorContent className="admin-rte__content" editor={editor} />
    <div className="admin-rte__status">{busy ?? `Khoảng ${state.words} từ`} · Dán từ Word/Google Docs giữ được tiêu đề, đậm/nghiêng, danh sách, bảng.</div>
    <input accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void insertImage(event.target.files?.[0])} ref={imageInput} type="file" />
    <input accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void insertBanner(event.target.files?.[0])} ref={bannerInput} type="file" />
    <input accept={importAccept} hidden onChange={(event) => void importFromFile(event.target.files?.[0])} ref={fileInput} type="file" />
  </div>;
}
