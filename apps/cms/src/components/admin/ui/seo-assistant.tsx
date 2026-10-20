"use client";

import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";

import { seoChecks, seoDescriptionLimit, seoTitleLimit, suggestSeoDescription, suggestSeoTitle, type PostLikeContent } from "@iorder/core/server/shared/seo";
import { publishedPublicUrl } from "@/lib/published-public-url";


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
  onChange: (field: "seoTitle" | "seoDescription", value: string) => void;
};

function Counter({ value, limit }: { value: number; limit: number }) {
  return <span className={value > limit ? "admin-seo__count admin-seo__count--over" : "admin-seo__count"}>{value}/{limit}</span>;
}

/**
 * Trợ lý SEO: xem trước kết quả Google, đếm ký tự, gợi ý tự động và danh sách kiểm tra.
 * Ô để trống thì website tự dùng đúng giá trị gợi ý hiện trong ô (placeholder).
 */
export function SeoAssistant({ title, seoTitle, seoDescription, excerpt, slug, path, hasCover, content, disabled, onChange }: SeoAssistantProps) {
  const suggestedTitle = suggestSeoTitle(title);
  const suggestedDescription = suggestSeoDescription(excerpt, content) ?? "";
  const shownTitle = seoTitle.trim() || suggestedTitle || "Tiêu đề bài viết";
  const shownDescription = seoDescription.trim() || suggestedDescription || "Thêm tóm tắt hoặc mô tả SEO để Google hiển thị đoạn giới thiệu.";
  const url = publishedPublicUrl(path);
  const checks = seoChecks({ title, seoTitle, seoDescription, excerpt, slug, hasCover, content });
  const passed = checks.filter((check) => check.ok).length;

  return <div className="admin-seo">
    <div aria-label="Xem trước trên Google" className="admin-seo__preview" role="group">
      <small>{url.replace(/^https?:\/\//, "").replace(/\//g, " › ")}</small>
      <strong>{shownTitle.length > seoTitleLimit ? `${shownTitle.slice(0, seoTitleLimit)}…` : shownTitle} | iOrder</strong>
      <p>{shownDescription}</p>
    </div>

    <label className="admin-field">
      <span className="admin-seo__label">Tiêu đề SEO <Counter limit={seoTitleLimit} value={(seoTitle.trim() || suggestedTitle).length} /></span>
      <input className="admin-input" disabled={disabled} maxLength={70} onChange={(event) => onChange("seoTitle", event.target.value)} placeholder={suggestedTitle || "Tự lấy từ tiêu đề bài viết"} value={seoTitle} />
    </label>
    <label className="admin-field">
      <span className="admin-seo__label">Mô tả SEO <Counter limit={seoDescriptionLimit} value={(seoDescription.trim() || suggestedDescription).length} /></span>
      <textarea className="admin-input" disabled={disabled} maxLength={180} onChange={(event) => onChange("seoDescription", event.target.value)} placeholder={suggestedDescription || "Tự lấy từ tóm tắt hoặc đoạn văn đầu tiên"} rows={3} value={seoDescription} />
    </label>
    <div className="admin-seo__actions">
      <p className="admin-help">Để trống thì website tự dùng nội dung gợi ý (chữ mờ trong ô).</p>
      <button className="admin-button admin-button--secondary admin-button--sm" disabled={disabled || (!suggestedTitle && !suggestedDescription)} onClick={() => { if (!seoTitle.trim() && suggestedTitle) onChange("seoTitle", suggestedTitle); if (!seoDescription.trim() && suggestedDescription) onChange("seoDescription", suggestedDescription); }} type="button"><Sparkles aria-hidden="true" size={15} />Điền theo gợi ý để chỉnh tiếp</button>
    </div>

    <div className="admin-seo__checks">
      <strong>Kiểm tra SEO: {passed}/{checks.length} đạt</strong>
      <ul>{checks.map((check) => <li className={check.ok ? "admin-seo__check admin-seo__check--ok" : "admin-seo__check"} key={check.id}>{check.ok ? <CircleCheck aria-hidden="true" size={15} /> : <CircleAlert aria-hidden="true" size={15} />}<span>{check.message}</span></li>)}</ul>
    </div>
  </div>;
}
