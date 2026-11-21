"use client";

import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import React, { useState } from "react";

import { maxRelatedKeywords, seoChecks, seoDescriptionLimit, seoGuide, seoTitleLimit, suggestFocusKeyword, suggestSeoDescription, suggestSeoTitle, withBrand, type PostLikeContent } from "@iorder/shared/server/shared/seo";
import { usePublicSiteUrl } from "../website-origin-context";
import { AdminHelpTip, AdminHintedField } from "./admin-help-tip";
import { AdminButton } from "./admin-button";
import { SearchConsoleQueries } from "./search-console-queries";
import { seoPageGuides, type SeoPageKind } from "./seo-page-guides";


type SeoAssistantProps = {
  title: string;
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
  slug: string;
  path: string;
  hasCover: boolean;
  content?: PostLikeContent | null;
  disabled?: boolean;
  /** Chỉ hiện các mục kiểm tra này (ví dụ Trang không có tóm tắt/ảnh bìa). */
  checkIds?: readonly string[];
  /** Cụm từ khách hay gõ (từ khóa chính); truyền cùng `onFocusKeywordChange` để hiện ô nhập và các mục kiểm tra từ khóa. */
  focusKeyword?: string;
  onFocusKeywordChange?: (value: string) => void;
  /** Gợi ý cụm từ từ tiêu đề; tắt với trang hệ thống ("Trang chủ", "Liên hệ"… không phải cụm từ khách tìm). */
  suggestKeyword?: boolean;
  /** Cụm từ liên quan (cách gọi khác của cùng ý, tối đa 4); truyền cùng `onRelatedKeywordsChange` để hiện ô nhập. Chỉ nên dùng ở nội dung dài (bài viết, sản phẩm). */
  relatedKeywords?: readonly string[];
  onRelatedKeywordsChange?: (value: string[]) => void;
  /** Đường dẫn công khai của nội dung đã đăng: hiện mục "Khách đang tìm gì để thấy trang này" (cụm Google ghi nhận cho trang, cần nối Search Console). */
  searchConsolePath?: string;
  /** Loại trang: hiện mục "Hướng dẫn SEO cho loại trang này" (việc website tự làm và việc người vận hành nên làm). */
  guideKind?: SeoPageKind;
  onChange: (field: "seoTitle" | "seoDescription", value: string) => void;
};

// Ô nhập một dòng, ngăn cách bằng dấu phẩy; chỉ giữ tối đa 4 cụm đầu.
function parseRelatedKeywords(text: string) {
  return text.split(/[,;\n]/).map((part) => part.trim()).filter(Boolean).slice(0, maxRelatedKeywords);
}

function Counter({ value, limit }: { value: number; limit: number }) {
  return <span className={value > limit ? "admin-seo__count admin-seo__count--over" : "admin-seo__count"}>{value}/{limit}</span>;
}

/**
 * Trợ lý SEO cho người không rành kỹ thuật: một điểm "sẵn sàng lên Google" kèm vài việc quan trọng nhất (có nút sửa nhanh
 * khi máy làm đúng được), xem trước kết quả Google, ô cụm từ khách hay gõ, tiêu đề/mô tả. Danh sách đầy đủ nằm trong mục thu gọn.
 * Ô tiêu đề/mô tả để trống thì website tự dùng đúng giá trị gợi ý hiện trong ô (placeholder).
 */
export function SeoAssistant({ title, seoTitle, seoDescription, excerpt, slug, path, hasCover, content, disabled, checkIds, focusKeyword = "", onFocusKeywordChange, suggestKeyword = true, relatedKeywords, onRelatedKeywordsChange, searchConsolePath, guideKind, onChange }: SeoAssistantProps) {
  // Ô cụm liên quan giữ chữ đang gõ riêng (dấu phẩy và khoảng trắng cuối không mất khi đổi qua mảng). Khi dữ liệu đổi từ ngoài
  // (bỏ thay đổi, mở bài khác) mà khác với chữ đang gõ thì lấy lại theo dữ liệu: điều chỉnh state ngay lúc render, không dùng effect.
  const relatedList = relatedKeywords ?? [];
  const relatedKey = relatedList.join("|");
  const [related, setRelated] = useState({ text: relatedList.join(", "), key: relatedKey });
  if (related.key !== relatedKey) setRelated({ text: parseRelatedKeywords(related.text).join("|") === relatedKey ? related.text : relatedList.join(", "), key: relatedKey });
  const suggestedTitle = suggestSeoTitle(title);
  const suggestedDescription = suggestSeoDescription(excerpt, content) ?? "";
  const suggestedKeyword = onFocusKeywordChange && suggestKeyword && !focusKeyword.trim() ? suggestFocusKeyword(title) : "";
  const shownTitle = seoTitle.trim() || suggestedTitle || "Tiêu đề bài viết";
  const shownDescription = seoDescription.trim() || suggestedDescription || "Thêm tóm tắt hoặc mô tả SEO để Google hiển thị đoạn giới thiệu.";
  const publicSiteUrl = usePublicSiteUrl();
  const url = publicSiteUrl(path);
  // Cùng quy tắc với website: chỉ thêm " | iOrder" khi tiêu đề chưa có chữ iOrder; Google cắt khoảng 60 ký tự.
  const googleTitle = withBrand(shownTitle);
  const input = { title, seoTitle, seoDescription, excerpt, slug, hasCover, content, focusKeyword: onFocusKeywordChange ? focusKeyword : undefined, relatedKeywords: onRelatedKeywordsChange ? relatedList : undefined };
  const checks = seoChecks(input).filter((check) => !checkIds || checkIds.includes(check.id));
  const guide = seoGuide(input, { checkIds });
  const pageGuide = guideKind ? seoPageGuides[guideKind] : null;

  return <div className="admin-seo" id="seo-assistant">
    <div className={`admin-seo__score admin-seo__score--${guide.status}`} role="group" aria-label="Mức sẵn sàng lên Google">
      <div className="admin-seo__score-head">
        {guide.status === "ready" ? <CircleCheck aria-hidden="true" size={18} /> : <CircleAlert aria-hidden="true" size={18} />}
        <strong>{guide.headline}</strong>
        <span>{guide.passed}/{guide.total}</span>
      </div>
      <div aria-label={`Đạt ${guide.passed} trên ${guide.total} mục`} aria-valuemax={guide.total} aria-valuemin={0} aria-valuenow={guide.passed} className="admin-seo__meter" role="progressbar"><span style={{ width: `${guide.total ? Math.round((guide.passed / guide.total) * 100) : 100}%` }} /></div>
      {guide.todo.length ? <>
        <p className="admin-seo__todo-title">{guide.todo.length === 1 && !guide.hidden ? "Việc nên làm" : `${guide.todo.length} việc nên làm trước`}</p>
        <ol className="admin-seo__todo">{guide.todo.map((item) => <li key={item.id}>
          <span>{item.message}</span>
          {item.fix ? <AdminButton disabled={disabled} leadingIcon={<Sparkles aria-hidden="true" size={14} />} onClick={() => onChange(item.fix!.field, item.fix!.value)} size="sm" variant="secondary">{item.fix.label}</AdminButton> : null}
        </li>)}</ol>
        {guide.hidden ? <p className="admin-seo__todo-more">Còn {guide.hidden} việc nhỏ khác: mở mục “Tất cả mục kiểm tra” ở cuối khung để xem.</p> : null}
      </> : null}
      {guide.hints.length ? <>
        <p className="admin-seo__todo-title">Làm thêm cho tốt hơn (không bắt buộc)</p>
        <ul className="admin-seo__hints">{guide.hints.map((hint) => <li key={hint.id}>{hint.message}</li>)}</ul>
      </> : null}
    </div>

    <div aria-label="Xem trước trên Google" className="admin-seo__preview" role="group">
      <small>{url.replace(/^https?:\/\//, "").replace(/\//g, " › ")}</small>
      <strong>{googleTitle.length > seoTitleLimit ? `${googleTitle.slice(0, seoTitleLimit)}…` : googleTitle}</strong>
      <p>{shownDescription}</p>
    </div>

    {onFocusKeywordChange ? <AdminHintedField hint="Cụm từ khách hàng hay gõ trên Google để tìm nội dung này, ví dụ “phần mềm quản lý nhà hàng”. Chỉ dùng để chấm điểm bên dưới, không hiện ra website." label="Cụm từ khách hay gõ">
      <label className="admin-field">
        <span className="admin-seo__label">Khách hay gõ cụm từ nào để tìm nội dung này?</span>
        <input className="admin-input" disabled={disabled} maxLength={80} onChange={(event) => onFocusKeywordChange(event.target.value)} placeholder="Ví dụ: phần mềm quản lý nhà hàng" value={focusKeyword} />
      </label>
      {suggestedKeyword ? <div className="admin-seo__actions"><small className="admin-help">Gợi ý từ tiêu đề:</small><AdminButton disabled={disabled} onClick={() => onFocusKeywordChange(suggestedKeyword)} size="sm" variant="secondary">{suggestedKeyword}</AdminButton></div> : null}
    </AdminHintedField> : null}
    {onRelatedKeywordsChange ? <AdminHintedField hint={`Các cách gọi khác của cùng ý, ví dụ “phần mềm POS”, “phần mềm tính tiền”. Chỉ kiểm tra có xuất hiện tự nhiên trong bài; không cần đưa vào tiêu đề hay mô tả. Ngăn cách bằng dấu phẩy, tối đa ${maxRelatedKeywords} cụm. Không hiện ra website.`} label="Cụm từ liên quan">
      <label className="admin-field">
        <span className="admin-seo__label">Cụm từ liên quan (tùy chọn, tối đa {maxRelatedKeywords})</span>
        <input className="admin-input" disabled={disabled} maxLength={400} onChange={(event) => { const text = event.target.value; setRelated((current) => ({ ...current, text })); onRelatedKeywordsChange(parseRelatedKeywords(text)); }} placeholder="Ví dụ: phần mềm POS, phần mềm tính tiền" value={related.text} />
      </label>
    </AdminHintedField> : null}
    {searchConsolePath ? <SearchConsoleQueries disabled={disabled} onUse={onFocusKeywordChange} path={searchConsolePath} /> : null}
    <label className="admin-field">
      <span className="admin-seo__label">Tiêu đề SEO <Counter limit={seoTitleLimit} value={(seoTitle.trim() || suggestedTitle).length} /></span>
      <input className="admin-input" disabled={disabled} maxLength={70} onChange={(event) => onChange("seoTitle", event.target.value)} placeholder={suggestedTitle || "Tự lấy từ tiêu đề bài viết"} value={seoTitle} />
    </label>
    <label className="admin-field">
      <span className="admin-seo__label">Mô tả SEO <Counter limit={seoDescriptionLimit} value={(seoDescription.trim() || suggestedDescription).length} /></span>
      <textarea className="admin-input" disabled={disabled} maxLength={180} onChange={(event) => onChange("seoDescription", event.target.value)} placeholder={suggestedDescription || "Tự lấy từ tóm tắt hoặc đoạn văn đầu tiên"} rows={3} value={seoDescription} />
    </label>
    <div className="admin-seo__actions">
      <AdminButton disabled={disabled || (!suggestedTitle && !suggestedDescription)} leadingIcon={<Sparkles aria-hidden="true" size={15} />} onClick={() => { if (!seoTitle.trim() && suggestedTitle) onChange("seoTitle", suggestedTitle); if (!seoDescription.trim() && suggestedDescription) onChange("seoDescription", suggestedDescription); }} size="sm" variant="secondary">Điền theo gợi ý để chỉnh tiếp</AdminButton>
      <AdminHelpTip label="Giải thích: tiêu đề và mô tả SEO để trống">Để trống thì website tự dùng nội dung gợi ý (chữ mờ trong ô).</AdminHelpTip>
    </div>

    {pageGuide ? <details className="admin-seo__checks admin-seo__all admin-seo__guide">
      <summary>Hướng dẫn SEO cho {pageGuide.title.toLocaleLowerCase("vi")}</summary>
      <p className="admin-seo__todo-title">Website đã tự làm giúp bạn</p>
      <ul className="admin-seo__guide-list">{pageGuide.auto.map((item) => <li key={item}><CircleCheck aria-hidden="true" size={15} /><span>{item}</span></li>)}</ul>
      <p className="admin-seo__todo-title">Bạn nên làm</p>
      <ol className="admin-seo__guide-list">{pageGuide.todo.map((item) => <li key={item}><span>{item}</span></li>)}</ol>
    </details> : null}

    <details className="admin-seo__checks admin-seo__all">
      <summary>Tất cả mục kiểm tra ({guide.passed}/{guide.total} đạt)</summary>
      <ul>{checks.map((check) => <li className={check.partial ? "admin-seo__check admin-seo__check--soft" : check.ok ? "admin-seo__check admin-seo__check--ok" : "admin-seo__check"} key={check.id}>{check.ok && !check.partial ? <CircleCheck aria-hidden="true" size={15} /> : <CircleAlert aria-hidden="true" size={15} />}<span>{check.message}</span></li>)}</ul>
    </details>
  </div>;
}
