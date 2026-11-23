"use client";

import React from "react";

import { toSlug } from "../../../lib/slug";
import { AdminButton } from "./admin-button";

/**
 * Ô "Đường dẫn" (slug) của mọi trình soạn nội dung (bài viết, sản phẩm/dịch vụ/giải pháp, thiết bị, trang): thường chỉ hiện dòng
 * đường dẫn kèm nút Sửa; mở ra thì có ô nhập, nút "Tạo từ tiêu đề/tên" và lời nhắc về chuyển hướng 301 khi nội dung đang hiển thị.
 * Trạng thái mở/đã chỉnh tay do màn cha giữ (editing, touched); onValueChange được gọi cả khi gõ lẫn khi bấm "Tạo từ…"
 * và màn cha nên đánh dấu "đã chỉnh tay" trong đó.
 */
export function AdminSlugField({
  currentStatus,
  editing,
  fieldClassName = "admin-field",
  id,
  inputClassName = "admin-input",
  maxLength,
  onEditingChange,
  onValueChange,
  pathHint = "Địa chỉ không dấu trên website: ",
  placeholder,
  publicPath,
  publishedLead,
  savedStatus,
  sourceNoun,
  sourceText,
  touched,
  value,
}: {
  /** Trạng thái đang soạn (form). */
  currentStatus: string;
  editing: boolean;
  fieldClassName?: string;
  id: string;
  inputClassName?: string;
  maxLength?: number;
  onEditingChange: (editing: boolean) => void;
  onValueChange: (slug: string) => void;
  pathHint?: string;
  placeholder?: string;
  publicPath: string;
  /** Mở đầu lời nhắc chuyển hướng, ví dụ "Bài đã xuất bản" hoặc "Thiết bị đang hiển thị". */
  publishedLead: string;
  /** Trạng thái đã lưu trên máy chủ; undefined khi chưa lưu lần nào. */
  savedStatus: string | undefined;
  /** "tiêu đề" hoặc "tên": gọi nguồn sinh đường dẫn trong nút và dòng ghi chú. */
  sourceNoun: string;
  sourceText: string;
  touched: boolean;
  value: string;
}) {
  if (!editing) {
    return <p className="admin-post-editor__slug-line"><span className="admin-help">Đường dẫn:</span> <span className="admin-post-editor__path">{publicPath}</span><button className="admin-post-editor__link" onClick={() => onEditingChange(true)} type="button">Sửa</button>{!touched ? <span className="admin-help"> · tự tạo theo {sourceNoun}</span> : null}</p>;
  }
  const generated = toSlug(sourceText, 80);
  return <div className="admin-post-editor__slug-edit">
    <div className={fieldClassName}><label className="admin-seo__label" htmlFor={id}>Đường dẫn<span className="admin-help">{pathHint}{publicPath}</span></label><span className="admin-post-editor__slug"><input autoFocus className={inputClassName} id={id} maxLength={maxLength} onChange={(event) => onValueChange(event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder={placeholder} required value={value} /><AdminButton disabled={!sourceText.trim() || generated === value} onClick={() => onValueChange(generated)} size="sm" variant="secondary">Tạo từ {sourceNoun}</AdminButton><AdminButton onClick={() => onEditingChange(false)} size="sm" variant="ghost">Xong</AdminButton></span></div>
    {savedStatus === "published" && currentStatus === "published" ? <small className="admin-help">{publishedLead}: khi lưu với đường dẫn mới, đường dẫn cũ tự chuyển hướng (301) sang đường dẫn mới.</small> : savedStatus === "published" ? <small className="admin-help admin-text-warning">Sau lần lưu này nội dung chưa hiện ngay trên website nên đổi đường dẫn sẽ không tạo chuyển hướng từ đường dẫn cũ.</small> : <small className="admin-help">Chỉ dùng chữ thường không dấu, số và dấu gạch ngang.</small>}
  </div>;
}
